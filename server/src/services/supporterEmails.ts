import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { Donation, SupporterEmail, User } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";
import { enqueue } from "./outbox.js";

const VERIFICATION_TTL_HOURS = 24;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// List emails attached to this supporter — the primary (from the User
// row) plus every row in supporter_emails. Primary is always first and
// is treated as verified when the user's email_verified_at is set.
export async function listEmails(
  user_id: string,
  organization_id: string
): Promise<
  Array<{
    id: string;
    email: string;
    primary: boolean;
    verified: boolean;
    added_at: string;
  }>
> {
  const uid = new mongoose.Types.ObjectId(user_id);
  const orgId = new mongoose.Types.ObjectId(organization_id);
  const [user, extras] = await Promise.all([
    User.findOne({ _id: uid, organization_id: orgId })
      .select({ email: 1, email_verified_at: 1, created_at: 1 })
      .lean(),
    SupporterEmail.find({ organization_id: orgId, user_id: uid })
      .sort({ created_at: 1 })
      .lean(),
  ]);
  if (!user) throw new AppError("not_found", "user not found");
  const out: Array<{ id: string; email: string; primary: boolean; verified: boolean; added_at: string }> = [
    {
      id: user._id.toString(),
      email: user.email,
      primary: true,
      verified: !!user.email_verified_at,
      added_at: (user.created_at ?? new Date(0)).toISOString(),
    },
  ];
  for (const e of extras) {
    out.push({
      id: e._id.toString(),
      email: e.email,
      primary: false,
      verified: !!e.verified_at,
      added_at: (e.created_at ?? new Date(0)).toISOString(),
    });
  }
  return out;
}

// Add a secondary email. The email is stored unverified until the user
// confirms the mailbox by opening the tokened link. Enumeration note:
// we don't leak whether another user already owns this address — we
// return ok and send nothing if the address is in use elsewhere, so the
// caller cannot probe for other supporters' billing emails.
export async function addEmail(
  user_id: string,
  organization_id: string,
  rawEmail: string
): Promise<{ ok: true }> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new AppError("bad_request", "email required");
  const uid = new mongoose.Types.ObjectId(user_id);
  const orgId = new mongoose.Types.ObjectId(organization_id);

  // If the primary email on the user matches, there's nothing to add.
  const user = await User.findOne({ _id: uid, organization_id: orgId })
    .select({ email: 1, display_name: 1 })
    .lean();
  if (!user) throw new AppError("not_found", "user not found");
  if (user.email === email) return { ok: true };

  // If a different supporter already owns this address (verified or not),
  // behave as if we sent the email: no state change, no information
  // leaked. The target user does not get spammed because we only enqueue
  // when we actually create a new row for the caller.
  const existingElsewhere = await SupporterEmail.findOne({
    organization_id: orgId,
    email,
    user_id: { $ne: uid },
  }).select({ _id: 1 });
  if (existingElsewhere) return { ok: true };

  // Also don't let one supporter claim a primary email of another user.
  const otherUser = await User.findOne({
    organization_id: orgId,
    email,
    _id: { $ne: uid },
  }).select({ _id: 1 });
  if (otherUser) return { ok: true };

  const raw = randomBytes(32).toString("base64url");
  const hash = sha256(raw);
  const expires = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3_600_000);

  await SupporterEmail.updateOne(
    { organization_id: orgId, email },
    {
      $set: {
        verification_token_hash: hash,
        verification_expires_at: expires,
      },
      $setOnInsert: {
        organization_id: orgId,
        user_id: uid,
        email,
        verified_at: null,
      },
    },
    { upsert: true }
  );

  await enqueue({
    organization_id: orgId,
    topic: "email.send_template",
    payload: {
      template: "supporter_email_verify",
      to: email,
      user_id: user_id,
      idempotency_key: `email-verify-${uid.toString()}-${hash.slice(0, 12)}`,
      data: {
        display_name: user.display_name,
        verify_url: `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/dashboard/account?verify_email=${raw}`,
        expires_hours: VERIFICATION_TTL_HOURS,
      },
    },
  });

  return { ok: true };
}

// Confirm a secondary email. On success, backfill-link every donation
// whose normalized billing email matches, so prior gifts land in the
// supporter's dashboard immediately. Case-insensitive match for safety
// against legacy mixed-case rows that pre-date the webhook normalization.
export async function verifyEmail(
  user_id: string,
  organization_id: string,
  token: string
): Promise<{ email: string; linked_donations: number }> {
  const hash = sha256(token);
  const uid = new mongoose.Types.ObjectId(user_id);
  const orgId = new mongoose.Types.ObjectId(organization_id);

  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const row = await SupporterEmail.findOne({
        organization_id: orgId,
        user_id: uid,
        verification_token_hash: hash,
      }).session(session);
      if (!row) throw new AppError("unauthorized", "invalid or expired token");
      if (row.verification_expires_at && row.verification_expires_at < new Date()) {
        throw new AppError("unauthorized", "verification link expired");
      }

      row.verified_at = new Date();
      row.verification_token_hash = null;
      row.verification_expires_at = null;
      await row.save({ session });

      const linkResult = await Donation.updateMany(
        {
          organization_id: orgId,
          donor_email: { $regex: `^${escapeRegex(row.email)}$`, $options: "i" },
          $or: [{ supporter_user_id: null }, { supporter_user_id: { $exists: false } }],
        },
        { $set: { supporter_user_id: uid } },
        { session }
      );

      return { email: row.email, linked_donations: linkResult.modifiedCount ?? 0 };
    });
    if (!result) throw new AppError("internal_error", "verification failed");
    return result;
  } finally {
    await session.endSession();
  }
}

// Remove a secondary email from the supporter's set. Historic donations
// stay linked (we don't retroactively orphan them); the alias is simply
// no longer honored for future auto-linking.
export async function removeEmail(
  user_id: string,
  organization_id: string,
  supporter_email_id: string
): Promise<void> {
  if (!mongoose.isValidObjectId(supporter_email_id))
    throw new AppError("bad_request", "invalid id");
  await SupporterEmail.deleteOne({
    _id: new mongoose.Types.ObjectId(supporter_email_id),
    organization_id: new mongoose.Types.ObjectId(organization_id),
    user_id: new mongoose.Types.ObjectId(user_id),
  });
}
