import mongoose, { Schema } from "mongoose";

export type OrgBranding = {
  // Short display name on the public site.
  display_name: string;
  // One-sentence strapline shown under the display name.
  tagline: string;
  // Longer hero copy, markdown.
  hero_markdown: string;
  // Accent color (hex, "#RRGGBB"). The theme file consumes it.
  accent_color: string;
  // Logo asset id (MediaAsset). Optional — the public endpoint resolves
  // to a derivatives URL at read time.
  logo_asset_id: mongoose.Types.ObjectId | null;
  // Footer copy / legal line.
  footer_line: string;
};

export type OrgInterOrg = {
  // Explicit opt-ins for the "pay it forward" ledger operation (§13).
  // Both sides must consent — the sender has to pass this flag to
  // originate transfers, and the recipient has to pass it to receive.
  send_enabled: boolean;
  receive_enabled: boolean;
  // Allow-list of recipient org slugs; empty = any receive-enabled org.
  allowed_recipient_slugs: string[];
};

export type OrganizationDoc = {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  public_id_prefix: string;
  base_currency: string;
  // Phase 13 — host-name mapping. Each host must be lowercase and
  // bare (no scheme, no port). The resolver matches on exact host; a
  // request to `www.foo.com` matches an entry `www.foo.com`, not
  // `foo.com`. One domain can only belong to one organisation (unique).
  domains: string[];
  branding: OrgBranding;
  inter_org: OrgInterOrg;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const BrandingSchema = new Schema<OrgBranding>(
  {
    display_name: { type: String, default: "", maxlength: 200 },
    tagline: { type: String, default: "", maxlength: 300 },
    hero_markdown: { type: String, default: "", maxlength: 5000 },
    accent_color: { type: String, default: "#2563eb", maxlength: 16 },
    logo_asset_id: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    footer_line: { type: String, default: "", maxlength: 300 },
  },
  { _id: false }
);

const InterOrgSchema = new Schema<OrgInterOrg>(
  {
    send_enabled: { type: Boolean, default: false },
    receive_enabled: { type: Boolean, default: false },
    allowed_recipient_slugs: { type: [String], default: [] },
  },
  { _id: false }
);

const OrganizationSchema = new Schema<OrganizationDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, maxlength: 64 },
    name: { type: String, required: true, maxlength: 200 },
    public_id_prefix: { type: String, required: true, uppercase: true, maxlength: 8 },
    base_currency: { type: String, required: true, uppercase: true, length: 3 },
    domains: { type: [String], default: [] },
    branding: { type: BrandingSchema, default: () => ({}) },
    inter_org: { type: InterOrgSchema, default: () => ({}) },
    settings: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "organizations" }
);

// Each host maps to AT MOST one organisation. Mongo's `unique` doesn't
// work on individual array elements, so we also expose the invariant in
// `services/tenancy.ts::setDomains`, which does a cross-org check in a
// transaction before writing. The multikey index below is for fast
// lookup of `{ domains: host }`.
OrganizationSchema.index({ domains: 1 });

export const Organization =
  (mongoose.models.Organization as mongoose.Model<OrganizationDoc> | undefined) ?? mongoose.model<OrganizationDoc>("Organization", OrganizationSchema);
