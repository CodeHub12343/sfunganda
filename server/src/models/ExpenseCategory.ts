import mongoose, { Schema } from "mongoose";

export type ExpenseCategoryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  retired_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const ExpenseCategorySchema = new Schema<ExpenseCategoryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    slug: { type: String, required: true, lowercase: true, maxlength: 60 },
    name: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 500 },
    retired_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "expense_categories",
  }
);

ExpenseCategorySchema.index({ organization_id: 1, slug: 1 }, { unique: true });

export const ExpenseCategory =
  mongoose.models.ExpenseCategory ??
  mongoose.model<ExpenseCategoryDoc>("ExpenseCategory", ExpenseCategorySchema);
