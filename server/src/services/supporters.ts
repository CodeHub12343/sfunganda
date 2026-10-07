import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import {
  Donation,
  Organization,
  RoleAssignment,
  SupporterProfile,
  User,
} from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";
import { hashPassword } from "@/auth/passwords.js";
import { env } from "@/config/env.js";
import { enqueue } from "./outbox.js";

const VERIFICATION_TTL_HOURS = 24;

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function primaryOrgId(): Promise<mongoose.Types.ObjectId> {
  const org = await Organization.findOne().sort({ _id: 1 }).select({ _id: 1 }).lean();
  if (!org) throw new AppError("unavailable", "no organization");
  return org._id;
}

// ============================================================================
// Signup — ENUMERATION-SAFE. We return success regardless of whether the
// email already exists. Email verification is skipped: a fresh signup is
// activated immediately (role + profile granted, matching donations linked)
// so the supporter can sign in right away. If the email is already in use
// we silently return ok without changing anything.
// ============================================================================

export async function signup(input: {
  email: string;
  display_name: string;
  password: string;
  country?: string;
  consent: true;
  website?: string;
}): Promise<{ ok: true }> {
  // Honeypot — silent success.
  if (input.website && input.website.trim().length > 0) {
    log.warn({ email_hash: sha256(input.email).slice(0, 8) }, "supporter.signup.honeypot");
    return { ok: true };
  }

  const orgId = await primaryOrgId();
  const emailLc = input.email.toLowerCase().trim();
  const existing = await User.findOne({ organization_id: orgId, email: emailLc });

  if (existing) {
    // If a prior signup left a pending account (from before verification was
    // removed), activate it now so the user isn't stuck.
    if (!existing.email_verified_at) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await activateSupporter(existing, orgId, session);
        });
      } finally {
        await session.endSession();
      }
    }
    return { ok: true };
  }

  // Fresh signup — create active and immediately provision the supporter
  // role, profile, and donation links.
  const password_hash = await hashPassword(input.password);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create(
        [
          {
            organization_id: orgId,
            email: emailLc,
            display_name: input.display_name.trim(),
            password_hash,
            status: "active",
            email_verified_at: new Date(),
            verification_token_hash: null,
            verification_expires_at: null,
          },
        ],
        { session }
      );
      await activateSupporter(user, orgId, session);
    });
  } finally {
    await session.endSession();
  }
  return { ok: true };
}

// Grants supporter role, creates the supporter profile, and links any
// pre-existing donations by email. Shared by signup and verifyEmail so
// both paths produce the same supporter state.
async function activateSupporter(
  user: { _id: mongoose.Types.ObjectId; email: string; display_name: string; email_verified_at?: Date | null; status?: string; verification_token_hash?: string | null; verification_expires_at?: Date | null; save: (opts?: { session?: mongoose.ClientSession }) => Promise<unknown> },
  orgId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<{ linked_donations: number }> {
  if (!user.email_verified_at) {
    user.email_verified_at = new Date();
    user.status = "active";
    user.verification_token_hash = null;
    user.verification_expires_at = null;
    await user.save({ session });
  }

  await RoleAssignment.updateOne(
    {
      organization_id: orgId,
      user_id: user._id,
      role: "supporter",
      scope_type: "organization",
      scope_id: null,
    },
    {
      $setOnInsert: {
        organization_id: orgId,
        user_id: user._id,
        role: "supporter",
        scope_type: "organization",
        scope_id: null,
        granted_by: user._id,
        granted_at: new Date(),
        revoked_at: null,
      },
    },
    { upsert: true, session }
  );

  const unsubRaw = randomBytes(32).toString("base64url");
  await SupporterProfile.updateOne(
    { organization_id: orgId, user_id: user._id },
    {
      $setOnInsert: {
        organization_id: orgId,
        user_id: user._id,
        display_name: user.display_name,
        anonymous_on_wall: false,
        country: null,
        prefs: defaultPrefs(),
        unsubscribe_token_hash: sha256(unsubRaw),
        deletion_requested_at: null,
        deletion_due_at: null,
        version: 0,
      },
    },
    { upsert: true, session }
  );

  const linkResult = await Donation.updateMany(
    {
      organization_id: orgId,
      // Case-insensitive match: legacy donations captured mixed-case
      // billing emails straight from Stripe (`Jane@Example.com`), while
      // user.email is stored lower-cased. An exact match would miss them.
      donor_email: { $regex: `^${escapeRegex(user.email)}$`, $options: "i" },
      $or: [{ supporter_user_id: null }, { supporter_user_id: { $exists: false } }],
    },
    { $set: { supporter_user_id: user._id } },
    { session }
  );
  return { linked_donations: linkResult.modifiedCount ?? 0 };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function resendVerification(email: string): Promise<{ ok: true }> {
  // Same shape as signup — enumeration safe.
  const orgId = await primaryOrgId();
  const user = await User.findOne({ organization_id: orgId, email: email.toLowerCase().trim() });
  if (!user || user.email_verified_at) return { ok: true };
  const { raw, hash } = mintVerificationToken();
  user.verification_token_hash = hash;
  user.verification_expires_at = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3_600_000);
  await user.save();
  await enqueue({
    organization_id: orgId,
    topic: "email.send_template",
    payload: {
      template: "supporter_verify",
      to: user.email,
      user_id: user._id.toString(),
      idempotency_key: `verify-${user._id.toString()}-${hash.slice(0, 12)}`,
      data: {
        display_name: user.display_name,
        verify_url: `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/supporters/verify?token=${raw}`,
        expires_hours: VERIFICATION_TTL_HOURS,
      },
    },
  });
  return { ok: true };
}

function mintVerificationToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256(raw) };
}

// ============================================================================
// Verification — flips the user to active, creates a SupporterProfile,
// grants the supporter role, and links any pre-existing donations whose
// donor_email matches.
// ============================================================================

export async function verifyEmail(token: string): Promise<{ user_id: string; linked_donations: number }> {
  const hash = sha256(token);
  const orgId = await primaryOrgId();
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const user = await User.findOne({
        organization_id: orgId,
        verification_token_hash: hash,
      }).session(session);
      if (!user) throw new AppError("unauthorized", "invalid or expired token");
      if (user.verification_expires_at && user.verification_expires_at < new Date()) {
        throw new AppError("unauthorized", "verification link expired");
      }

      user.email_verified_at = new Date();
      user.status = "active";
      user.verification_token_hash = null;
      user.verification_expires_at = null;
      await user.save({ session });

      // Grant supporter role (scope: organization).
      await RoleAssignment.updateOne(
        {
          organization_id: orgId,
          user_id: user._id,
          role: "supporter",
          scope_type: "organization",
          scope_id: null,
        },
        {
          $setOnInsert: {
            organization_id: orgId,
            user_id: user._id,
            role: "supporter",
            scope_type: "organization",
            scope_id: null,
            granted_by: user._id,
            granted_at: new Date(),
            revoked_at: null,
          },
        },
        { upsert: true, session }
      );

      // Supporter profile with a per-row unsubscribe token.
      const unsubRaw = randomBytes(32).toString("base64url");
      await SupporterProfile.updateOne(
        { organization_id: orgId, user_id: user._id },
        {
          $setOnInsert: {
            organization_id: orgId,
            user_id: user._id,
            display_name: user.display_name,
            anonymous_on_wall: false,
            country: null,
            prefs: defaultPrefs(),
            unsubscribe_token_hash: sha256(unsubRaw),
            deletion_requested_at: null,
            deletion_due_at: null,
            version: 0,
          },
        },
        { upsert: true, session }
      );

      // Link donations whose donor_email matches (case-insensitive). We don't
      // overwrite donor_name — the Stripe billing name is more trustworthy
      // for receipts than what the user types later.
      const linkResult = await Donation.updateMany(
        {
          organization_id: orgId,
          donor_email: { $regex: `^${escapeRegex(user.email)}$`, $options: "i" },
          $or: [{ supporter_user_id: null }, { supporter_user_id: { $exists: false } }],
        },
        { $set: { supporter_user_id: user._id } },
        { session }
      );
      return { user_id: user._id.toString(), linked_donations: linkResult.modifiedCount ?? 0 };
    });
    if (!result) throw new AppError("internal_error", "transaction returned no result");
    return result;
  } finally {
    await session.endSession();
  }
}

function defaultPrefs() {
  return {
    accomplishment_published: "immediate",
    milestone_completed: "weekly_digest",
    project_update: "weekly_digest",
    donation_receipt: "immediate",
    channels: { email: true, in_app: true },
    unsubscribed_all: false,
  };
}

// ============================================================================
// Self-service management.
// ============================================================================

export async function updatePreferences(
  user_id: string,
  patch: {
    anonymous_on_wall?: boolean;
    prefs?: Partial<{
      accomplishment_published: string;
      milestone_completed: string;
      project_update: string;
      donation_receipt: string;
      channels: { email?: boolean; in_app?: boolean };
      unsubscribed_all: boolean;
    }>;
  }
): Promise<void> {
  const orgId = await primaryOrgId();
  const uid = new mongoose.Types.ObjectId(user_id);
  const update: Record<string, unknown> = {};
  if (patch.anonymous_on_wall !== undefined) update.anonymous_on_wall = patch.anonymous_on_wall;
  if (patch.prefs) {
    if (patch.prefs.accomplishment_published)
      update["prefs.accomplishment_published"] = patch.prefs.accomplishment_published;
    if (patch.prefs.milestone_completed)
      update["prefs.milestone_completed"] = patch.prefs.milestone_completed;
    if (patch.prefs.project_update) update["prefs.project_update"] = patch.prefs.project_update;
    if (patch.prefs.donation_receipt)
      update["prefs.donation_receipt"] = patch.prefs.donation_receipt;
    if (patch.prefs.channels) {
      if (patch.prefs.channels.email !== undefined)
        update["prefs.channels.email"] = patch.prefs.channels.email;
      if (patch.prefs.channels.in_app !== undefined)
        update["prefs.channels.in_app"] = patch.prefs.channels.in_app;
    }
    if (patch.prefs.unsubscribed_all !== undefined)
      update["prefs.unsubscribed_all"] = patch.prefs.unsubscribed_all;
  }
  await SupporterProfile.updateOne({ organization_id: orgId, user_id: uid }, { $set: update });
}

export async function oneClickUnsubscribe(token: string): Promise<{ ok: boolean }> {
  const h = sha256(token);
  const result = await SupporterProfile.updateOne(
    { unsubscribe_token_hash: h },
    { $set: { "prefs.unsubscribed_all": true } }
  );
  return { ok: result.matchedCount > 0 };
}

// Soft deletion — 30-day grace period, then a cleanup job (not shipped in
// this phase) hard-deletes. Donations are retained for audit; the user_id
// link is cleared on hard delete so the dashboard cannot be reconstructed.
export async function requestDeletion(user_id: string): Promise<{ due_at: Date }> {
  const orgId = await primaryOrgId();
  const due = new Date(Date.now() + 30 * 24 * 3_600_000);
  await SupporterProfile.updateOne(
    { organization_id: orgId, user_id: new mongoose.Types.ObjectId(user_id) },
    { $set: { deletion_requested_at: new Date(), deletion_due_at: due } }
  );
  // Also suspend sign-in immediately so the account is unreachable.
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(user_id), organization_id: orgId },
    { $set: { status: "suspended" } }
  );
  return { due_at: due };
}

export async function cancelDeletion(user_id: string): Promise<void> {
  const orgId = await primaryOrgId();
  await SupporterProfile.updateOne(
    { organization_id: orgId, user_id: new mongoose.Types.ObjectId(user_id) },
    { $set: { deletion_requested_at: null, deletion_due_at: null } }
  );
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(user_id), organization_id: orgId, status: "suspended" },
    { $set: { status: "active" } }
  );
}

// Export: everything about THIS user that we hold on the public side.
export async function exportSelf(user_id: string): Promise<Record<string, unknown>> {
  const orgId = await primaryOrgId();
  const uid = new mongoose.Types.ObjectId(user_id);
  const [user, profile, follows, donations, notifications] = await Promise.all([
    User.findOne({ _id: uid, organization_id: orgId })
      .select({ password_hash: 0, mfa_secret: 0, mfa_recovery_codes_hashed: 0 })
      .lean(),
    SupporterProfile.findOne({ organization_id: orgId, user_id: uid }).lean(),
    (await import("@/models/index.js")).ProjectFollow.find({
      organization_id: orgId,
      user_id: uid,
    }).lean(),
    (await import("@/models/index.js")).Donation.find({
      organization_id: orgId,
      supporter_user_id: uid,
    })
      .select({ stripe_customer_id: 0 })
      .lean(),
    (await import("@/models/index.js")).Notification.find({ user_id: uid })
      .sort({ created_at: -1 })
      .limit(500)
      .lean(),
  ]);
  if (!user) throw new AppError("not_found", "user not found");
  return {
    exported_at: new Date().toISOString(),
    user,
    profile,
    follows,
    donations,
    notifications,
  };
}
