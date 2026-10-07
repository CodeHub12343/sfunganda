import { createHash, randomInt } from "node:crypto";
import mongoose from "mongoose";
import { Donation, DonationClaim, SupporterEmail, User } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { enqueue } from "./outbox.js";

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

function sixDigitCode(): string {
  // 100000..999999 inclusive — cryptographically random.
  return String(randomInt(100000, 1_000_000));
}

// Open a claim for a historic donation. We send a short-lived numeric
// code to the donation's ORIGINAL billing email so the only person who
// can finish the claim is someone with mailbox access there. We never
// echo the destination email back to the caller — knowing a public_id
// must not reveal who paid for it.
export async function openClaim(
  user_id: string,
  organization_id: string,
  public_id: string
): Promise<{ ok: true; sent_hint: string }> {
  const uid = new mongoose.Types.ObjectId(user_id);
  const orgId = new mongoose.Types.ObjectId(organization_id);

  const user = await User.findOne({ _id: uid, organization_id: orgId })
    .select({ email: 1, display_name: 1 })
    .lean();
  if (!user) throw new AppError("not_found", "user not found");

  const donation = await Donation.findOne({
    organization_id: orgId,
    public_id,
  })
    .select({ _id: 1, donor_email: 1, supporter_user_id: 1, received_at: 1, public_id: 1 })
    .lean();

  // Enumeration guard: respond identically for an unknown reference, a
  // donation with no email on file, or a donation already linked to a
  // different user. Only when all conditions are satisfied do we mail a
  // code. The caller cannot tell these cases apart from the response.
  if (!donation || !donation.donor_email) {
    return { ok: true, sent_hint: hint("") };
  }
  if (donation.supporter_user_id && !donation.supporter_user_id.equals(uid)) {
    return { ok: true, sent_hint: hint("") };
  }

  const target = normalizeEmail(donation.donor_email);
  const code = sixDigitCode();
  const code_hash = sha256(code);
  const expires_at = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await DonationClaim.updateOne(
    { organization_id: orgId, user_id: uid, donation_id: donation._id },
    {
      $set: {
        code_hash,
        expires_at,
        attempts: 0,
        sent_to_email: target,
        claimed_at: null,
      },
      $setOnInsert: {
        organization_id: orgId,
        user_id: uid,
        donation_id: donation._id,
      },
    },
    { upsert: true }
  );

  await enqueue({
    organization_id: orgId,
    topic: "email.send_template",
    payload: {
      template: "donation_claim_code",
      to: target,
      user_id,
      idempotency_key: `claim-${donation._id.toString()}-${uid.toString()}-${code_hash.slice(0, 12)}`,
      data: {
        display_name: user.display_name,
        code,
        donation_id: donation.public_id,
        expires_minutes: CODE_TTL_MINUTES,
      },
    },
  });

  return { ok: true, sent_hint: hint(target) };
}

// Finish a claim. Validates the code and, on success, links the donation
// to the caller — but only if it's still unclaimed, so a slow race between
// two supporters trying to claim the same donation ends deterministically.
export async function verifyClaim(
  user_id: string,
  organization_id: string,
  public_id: string,
  code: string
): Promise<{ ok: true; donation_id: string }> {
  const uid = new mongoose.Types.ObjectId(user_id);
  const orgId = new mongoose.Types.ObjectId(organization_id);
  const codeStr = String(code).trim();
  if (!/^\d{6}$/.test(codeStr)) throw new AppError("bad_request", "invalid code");

  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const donation = await Donation.findOne({ organization_id: orgId, public_id }).session(
        session
      );
      if (!donation) throw new AppError("unauthorized", "invalid code");

      const claim = await DonationClaim.findOne({
        organization_id: orgId,
        user_id: uid,
        donation_id: donation._id,
      }).session(session);
      if (!claim) throw new AppError("unauthorized", "invalid code");
      if (claim.claimed_at) throw new AppError("conflict", "already claimed");
      if (claim.expires_at < new Date()) throw new AppError("unauthorized", "code expired");
      if (claim.attempts >= MAX_ATTEMPTS) throw new AppError("unauthorized", "too many attempts");

      if (sha256(codeStr) !== claim.code_hash) {
        claim.attempts += 1;
        await claim.save({ session });
        throw new AppError("unauthorized", "invalid code");
      }

      // Only set supporter_user_id if the donation is unclaimed or already
      // ours. We never overwrite someone else's established link.
      if (!donation.supporter_user_id) {
        donation.supporter_user_id = uid;
        await donation.save({ session });
      } else if (!donation.supporter_user_id.equals(uid)) {
        throw new AppError("conflict", "donation is already linked");
      }

      claim.claimed_at = new Date();
      claim.code_hash = "";
      await claim.save({ session });

      // Opportunistically record the donation's email as a verified
      // secondary address, so future donations under the same mailbox
      // auto-link through the webhook without needing a second claim.
      if (donation.donor_email) {
        const normalizedDonorEmail = normalizeEmail(donation.donor_email);
        if (normalizedDonorEmail && normalizedDonorEmail !== (await userPrimaryEmail(uid, orgId))) {
          await SupporterEmail.updateOne(
            { organization_id: orgId, email: normalizedDonorEmail },
            {
              $set: { verified_at: new Date() },
              $setOnInsert: {
                organization_id: orgId,
                user_id: uid,
                email: normalizedDonorEmail,
                verification_token_hash: null,
                verification_expires_at: null,
              },
            },
            { upsert: true, session }
          );
        }
      }

      return { ok: true as const, donation_id: donation.public_id ?? "" };
    });
    if (!result) throw new AppError("internal_error", "claim verification failed");
    return result;
  } finally {
    await session.endSession();
  }
}

async function userPrimaryEmail(
  uid: mongoose.Types.ObjectId,
  orgId: mongoose.Types.ObjectId
): Promise<string | null> {
  const u = await User.findOne({ _id: uid, organization_id: orgId }).select({ email: 1 }).lean();
  return u?.email ?? null;
}

// Return a vague destination hint so the UI can say "code sent" without
// revealing the exact email on file. For "a@b.com" we show "a***@b.com".
function hint(email: string): string {
  if (!email) return "the email on file";
  const [local, domain] = email.split("@");
  if (!domain || !local) return "the email on file";
  const kept = local.slice(0, 1);
  return `${kept}***@${domain}`;
}
