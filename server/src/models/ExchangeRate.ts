import mongoose, { Schema } from "mongoose";

// Daily close rates stored once per (from, to, day). Transactions snapshot
// the rate at creation so later rate drift doesn't move historical figures.
export type ExchangeRateDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  from_currency: string;
  to_currency: string;
  on_date: Date; // date-only midnight UTC
  rate: number; // 1 from == rate to
  source: string;
  fetched_at: Date;
  created_at: Date;
};

const ExchangeRateSchema = new Schema<ExchangeRateDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    from_currency: { type: String, required: true, maxlength: 3, uppercase: true },
    to_currency: { type: String, required: true, maxlength: 3, uppercase: true },
    on_date: { type: Date, required: true },
    rate: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, maxlength: 40 },
    fetched_at: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "exchange_rates",
  }
);

ExchangeRateSchema.index(
  { organization_id: 1, from_currency: 1, to_currency: 1, on_date: 1 },
  { unique: true }
);
ExchangeRateSchema.index({ organization_id: 1, on_date: -1 });

export const ExchangeRate =
  mongoose.models.ExchangeRate ??
  mongoose.model<ExchangeRateDoc>("ExchangeRate", ExchangeRateSchema);
