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

export const Community =
  mongoose.models.Community ?? mongoose.model<CommunityDoc>("Community", CommunitySchema);
