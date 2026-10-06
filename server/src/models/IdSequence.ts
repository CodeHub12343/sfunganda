import mongoose, { Schema } from "mongoose";

// Monotonic counter for public IDs (e.g. SFU-2026-0001). Allocated inside a
// transaction via findOneAndUpdate + $inc, so rejected drafts never consume a
// number.
export type IdSequenceDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  kind: string; // "accomplishment" | "transaction" | ...
  year: number;
  next_value: number;
  updated_at: Date;
};

const IdSequenceSchema = new Schema<IdSequenceDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    kind: { type: String, required: true, maxlength: 40 },
    year: { type: Number, required: true },
    next_value: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: "updated_at" }, collection: "id_sequences" }
);

IdSequenceSchema.index({ organization_id: 1, kind: 1, year: 1 }, { unique: true });

export const IdSequence =
  (mongoose.models.IdSequence as mongoose.Model<IdSequenceDoc> | undefined) ?? mongoose.model<IdSequenceDoc>("IdSequence", IdSequenceSchema);
