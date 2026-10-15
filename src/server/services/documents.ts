import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { invalid, notFound } from "@/server/http/errors";
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_BYTES,
  removeObject,
  signedDownload,
  signedUpload,
  storageKey,
} from "@/server/storage";
import { dbDate } from "@/lib/time";
import type { DocOwner } from "@/generated/prisma/client";

/**
 * Compliance documents (bus RC, fitness, insurance…; driver licences).
 *
 * Two steps, so the file never transits a serverless function:
 *   1. `uploadUrl`: validate type and size, mint a signed upload URL and key;
 *   2. the browser PUTs the file there;
 *   3. `attach`: record the Document row against its owner.
 */

export const DOC_KINDS = {
  BUS: ["rc", "fitness", "insurance", "permit", "puc", "speed"],
  DRIVER: ["licence", "police_verification", "medical"],
  ATTENDANT: ["police_verification", "medical", "first_aid", "aadhaar"],
  STUDENT: ["medical"],
} as const satisfies Record<DocOwner, readonly string[]>;

const OWNER_OF: Record<string, DocOwner> = {
  buses: "BUS",
  drivers: "DRIVER",
  attendants: "ATTENDANT",
  students: "STUDENT",
};

export const uploadRequestSchema = z.object({
  kind: z.string().min(1).max(40),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Files must be under 10 MB."),
  contentType: z.string().refine((t) => ALLOWED_TYPES.includes(t), "Upload a PDF or a photo."),
});

export const attachSchema = z.object({
  kind: z.string().min(1).max(40),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  storageKey: z.string().min(10).max(300),
  issuedOn: z.iso.date().optional(),
  expiresOn: z.iso.date().optional(),
});

async function owner(ctx: Ctx, resource: string, id: string): Promise<DocOwner> {
  const ownerType = OWNER_OF[resource];
  if (!ownerType) throw notFound("Resource");
  const where = { id, schoolId: ctx.schoolId, deletedAt: null };
  const found =
    ownerType === "BUS"
      ? await ctx.db.bus.findFirst({ where })
      : ownerType === "STUDENT"
        ? await ctx.db.student.findFirst({ where })
        : await ctx.db.crew.findFirst({ where: { ...where, role: ownerType === "DRIVER" ? "DRIVER" : "ATTENDANT" } });
  if (!found) throw notFound("Record");
  return ownerType;
}

function checkKind(ownerType: DocOwner, kind: string) {
  if (!(DOC_KINDS[ownerType] as readonly string[]).includes(kind)) {
    throw invalid("That document type does not apply here.", { kind: "Unknown document type." });
  }
}

export async function uploadUrl(ctx: Ctx, resource: string, id: string, input: z.infer<typeof uploadRequestSchema>) {
  const ownerType = await owner(ctx, resource, id);
  checkKind(ownerType, input.kind);
  const key = storageKey(ctx.schoolId, `${resource}/${id}`, input.fileName);
  const target = await signedUpload(key);
  ctx.audit({ action: "DOCUMENT_UPLOAD_STARTED", entityType: ownerType, entityId: id, meta: { kind: input.kind } });
  return { storageKey: key, ...target };
}

export async function attach(ctx: Ctx, resource: string, id: string, input: z.infer<typeof attachSchema>) {
  const ownerType = await owner(ctx, resource, id);
  checkKind(ownerType, input.kind);
  if (!input.storageKey.startsWith(`${ctx.schoolId}/${resource}/${id}/`)) {
    throw invalid("That upload does not belong to this record.");
  }
  // One current document per kind: the previous file is replaced.
  const previous = await ctx.db.document.findMany({ where: { schoolId: ctx.schoolId, ownerType, ownerId: id, kind: input.kind } });
  await ctx.db.document.deleteMany({ where: { id: { in: previous.map((d) => d.id) } } });
  const doc = await ctx.db.document.create({
    data: {
      schoolId: ctx.schoolId,
      ownerType,
      ownerId: id,
      kind: input.kind,
      fileName: input.fileName,
      storageKey: input.storageKey,
      sizeBytes: input.size,
      issuedOn: input.issuedOn ? dbDate(input.issuedOn) : null,
      expiresOn: input.expiresOn ? dbDate(input.expiresOn) : null,
    },
  });
  for (const p of previous) await removeObject(p.storageKey).catch(() => undefined);
  ctx.audit({ action: "DOCUMENT_ATTACHED", entityType: ownerType, entityId: id, meta: { kind: input.kind, documentId: doc.id } });
  return doc.id;
}

export async function removeDocument(ctx: Ctx, documentId: string) {
  const doc = await ctx.db.document.findFirst({ where: { id: documentId, schoolId: ctx.schoolId } });
  if (!doc) throw notFound("Document");
  await ctx.db.document.delete({ where: { id: doc.id } });
  await removeObject(doc.storageKey).catch(() => undefined);
  ctx.audit({ action: "DOCUMENT_REMOVED", entityType: doc.ownerType, entityId: doc.ownerId, meta: { kind: doc.kind } });
}

/** Where to fetch the file; viewing a document is audited. */
export async function documentForDownload(ctx: Ctx, documentId: string) {
  const doc = await ctx.db.document.findFirst({ where: { id: documentId, schoolId: ctx.schoolId } });
  if (!doc) throw notFound("Document");
  ctx.audit({ action: "DOCUMENT_VIEW", entityType: doc.ownerType, entityId: doc.ownerId, meta: { documentId: doc.id, kind: doc.kind } });
  return { doc, url: await signedDownload(doc.storageKey, doc.fileName) };
}
