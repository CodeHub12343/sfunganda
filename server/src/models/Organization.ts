import mongoose, { Schema } from "mongoose";

export type OrganizationDoc = {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  public_id_prefix: string;
  base_currency: string;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const OrganizationSchema = new Schema<OrganizationDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, maxlength: 64 },
    name: { type: String, required: true, maxlength: 200 },
    public_id_prefix: { type: String, required: true, uppercase: true, maxlength: 8 },
    base_currency: { type: String, required: true, uppercase: true, length: 3 },
    settings: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "organizations" }
);

export const Organization =
  mongoose.models.Organization ?? mongoose.model<OrganizationDoc>("Organization", OrganizationSchema);
