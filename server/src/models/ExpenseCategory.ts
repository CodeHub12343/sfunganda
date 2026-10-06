import mongoose, { Schema } from "mongoose";

export type ExpenseCategoryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  // Phase 8: flags that drive public summaries.
  //   is_operating → counted in the operating-expense half of the
  //                  sustainability ratio (business revenue ÷ operating
  //                  expenses, excluding donations).
  //   is_programme → "to the children" bucket in the Transparency Center.
  // Both default false so adding a new category is explicit.
  is_operating: boolean;
  is_programme: boolean;
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
    is_operating: { type: Boolean, required: true, default: false },
    is_programme: { type: Boolean, required: true, default: false },
    retired_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "expense_categories",
  }
);

ExpenseCategorySchema.index({ organization_id: 1, slug: 1 }, { unique: true });

export const ExpenseCategory =
  (mongoose.models.ExpenseCategory as mongoose.Model<ExpenseCategoryDoc> | undefined) ?? mongoose.model<ExpenseCategoryDoc>("ExpenseCategory", ExpenseCategorySchema);
