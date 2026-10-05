import { connectDB, disconnectDB } from "@/config/db.js";
import { log } from "@/util/log.js";
import { Organization, User, RoleAssignment } from "@/models/index.js";
import { hashPassword } from "@/auth/passwords.js";

// =============================================================================
// Seed script — idempotent. Creates the single launch organisation and a
// bootstrap founder, if none exists. Reads credentials from the environment
// so we don't ship a hardcoded password:
//   SEED_FOUNDER_EMAIL      e.g. "founder@sfuganda.local"
//   SEED_FOUNDER_PASSWORD   at least 12 characters
//   SEED_FOUNDER_NAME       display name
//   SEED_ORG_SLUG           default "sfu"
//   SEED_ORG_NAME           default "Sarah's Foundation Uganda"
// =============================================================================

async function main(): Promise<void> {
  await connectDB();

  const orgSlug = process.env.SEED_ORG_SLUG ?? "sfu";
  const orgName = process.env.SEED_ORG_NAME ?? "Sarah's Foundation Uganda";

  let org = await Organization.findOne({ slug: orgSlug });
  if (!org) {
    org = await Organization.create({
      slug: orgSlug,
      name: orgName,
      public_id_prefix: "SFU",
      base_currency: "USD",
      settings: {},
    });
    log.info({ id: org._id.toString() }, "seed.organization.created");
  } else {
    log.info({ id: org._id.toString() }, "seed.organization.exists");
  }

  const email = (process.env.SEED_FOUNDER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_FOUNDER_PASSWORD ?? "";
  const displayName = process.env.SEED_FOUNDER_NAME ?? "Founder";

  if (!email || !password) {
    log.warn("seed.founder.skipped — set SEED_FOUNDER_EMAIL and SEED_FOUNDER_PASSWORD");
    await disconnectDB();
    return;
  }

  let user = await User.findOne({ organization_id: org._id, email });
  if (!user) {
    user = await User.create({
      organization_id: org._id,
      email,
      display_name: displayName,
      password_hash: await hashPassword(password),
      status: "active",
    });
    log.info({ id: user._id.toString() }, "seed.founder.created");
  } else {
    log.info({ id: user._id.toString() }, "seed.founder.exists");
  }

  const existing = await RoleAssignment.findOne({
    organization_id: org._id,
    user_id: user._id,
    role: "founder",
    revoked_at: null,
  });
  if (!existing) {
    await RoleAssignment.create({
      organization_id: org._id,
      user_id: user._id,
      role: "founder",
      scope_type: "organization",
      scope_id: null,
      granted_by: user._id,
      granted_at: new Date(),
    });
    log.info("seed.founder.role_assigned");
  }

  await disconnectDB();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : "unknown" }, "seed.failed");
  process.exit(1);
});
