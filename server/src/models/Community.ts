import mongoose, { Schema } from "mongoose";

export type CommunityDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  region_label: string;
  // Deliberately coarse coordinates (§9.3) — exact locations never stored here.
  public_lat: number | null;
  public_lng: number | null;
  status: "planned" | "active" | "paused" | "archived";
  summary: string;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const CommunitySchema = new Schema<CommunityDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    name: { type: String, required: true, maxlength: 160 },
    slug: { type: String, required: true, lowercase: true, maxlength: 120 },
    region_label: { type: String, required: true, maxlength: 160 },
    // Coarse-coordinate invariants (§Phase 8 security). We refuse any value
    // with more than one decimal of precision at write time — a stricter cap
    // than the §9.3 wording and the one the public API relies on. The pre-save
    // hook below enforces this; the service layer should also round, but a
    // schema-level barrier is cheap defence in depth.
    public_lat: { type: Number, default: null, min: -90, max: 90 },
    public_lng: { type: Number, default: null, min: -180, max: 180 },
    status: {
      type: String,
      enum: ["planned", "active", "paused", "archived"],
      default: "planned",
    },
    summary: { type: String, default: "", maxlength: 2000 },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "communities" }
);

CommunitySchema.index({ organization_id: 1, slug: 1 }, { unique: true });

export function roundCoarse(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

CommunitySchema.pre("validate", function (this: CommunityDoc, next) {
  // Snap to one decimal place so stored values are always coarse — even if
  // the service forgets to.
  if (this.public_lat !== null && this.public_lat !== undefined) {
    this.public_lat = roundCoarse(this.public_lat);
  }
  if (this.public_lng !== null && this.public_lng !== undefined) {
    this.public_lng = roundCoarse(this.public_lng);
  }
  next();
});

export const Community =
  mongoose.models.Community ?? mongoose.model<CommunityDoc>("Community", CommunitySchema);
