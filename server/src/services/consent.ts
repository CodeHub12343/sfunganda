import mongoose from "mongoose";
import { ConsentRecord, MediaLink } from "@/models/index.js";
import type { ConsentRecordDoc } from "@/models/ConsentRecord.js";
import { AppError } from "@/util/errors.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";

export type ConsentInput = {
  subject_identifier: string;
  subject_display: string;
  media_asset_ids?: string[];
  scope: {
    web: boolean;
    social: boolean;
    print: boolean;
    internal_only: boolean;
    expires_at?: string;
  };
  signed_form_asset_id?: string;
  minor: boolean;
  guardian_name?: string;
  guardian_relationship?: string;
  note?: string;
};

export async function recordConsent(actor: Actor, input: ConsentInput): Promise<ConsentRecordDoc> {
  if (!can(actor, "media.publish")) throw new AppError("forbidden", "cannot record consent");
  if (input.minor && !input.guardian_name) {
    throw new AppError("unprocessable", "guardian consent required for minors", {
      fields: { guardian_name: "required" },
    });
  }
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const doc = await ConsentRecord.create({
    organization_id: orgId,
    subject_identifier: input.subject_identifier,
    subject_display: input.subject_display,
    scope: {
      web: !!input.scope.web,
      social: !!input.scope.social,
      print: !!input.scope.print,
      internal_only: !!input.scope.internal_only,
      expires_at: input.scope.expires_at ? new Date(input.scope.expires_at) : null,
    },
    minor: input.minor,
    guardian_name: input.guardian_name ?? null,
    guardian_relationship: input.guardian_relationship ?? null,
    signed_form_asset_id: input.signed_form_asset_id
      ? new mongoose.Types.ObjectId(input.signed_form_asset_id)
      : null,
    note: input.note ?? null,
    granted_by: new mongoose.Types.ObjectId(actor.user_id),
    granted_at: new Date(),
  });

  for (const assetId of input.media_asset_ids ?? []) {
    await MediaLink.updateOne(
      {
        organization_id: orgId,
        asset_id: new mongoose.Types.ObjectId(assetId),
        target: "consent_record",
        target_id: doc._id,
        role: "subject",
      },
      {
        $setOnInsert: {
          organization_id: orgId,
          asset_id: new mongoose.Types.ObjectId(assetId),
          target: "consent_record",
          target_id: doc._id,
          role: "subject",
          created_by: new mongoose.Types.ObjectId(actor.user_id),
          created_at: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return doc.toObject();
}

export async function revokeConsent(
  actor: Actor,
  consent_id: string,
  reason: string
): Promise<void> {
  if (!can(actor, "media.publish")) throw new AppError("forbidden", "cannot revoke consent");
  const doc = await ConsentRecord.findById(consent_id);
  if (!doc) throw new AppError("not_found", "consent not found");
  if (doc.organization_id.toString() !== actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  doc.revoked_at = new Date();
  doc.revoked_by = new mongoose.Types.ObjectId(actor.user_id);
  doc.revocation_reason = reason.slice(0, 500);
  await doc.save();
}
