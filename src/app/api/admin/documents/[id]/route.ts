import { route } from "@/server/http/handler";
import { documentForDownload, removeDocument } from "@/server/services/documents";
import { loadAdminData } from "@/server/services/masters/view";
import { readLocal } from "@/server/storage";

/** GET /api/admin/documents/:id: the file itself (redirect to a 60-second signed URL). */
export const GET = route({ app: "admin" }, async ({ ctx }) => {
  const { doc, url } = await documentForDownload(ctx, ctx.params.id!);
  if (url) return Response.redirect(url, 302);
  const bytes = await readLocal(doc.storageKey);
  if (!bytes) return new Response("This file is not available in this environment.", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": doc.fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      "content-disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
});

/** DELETE /api/admin/documents/:id */
export const DELETE = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"] }, async ({ ctx }) => {
  await removeDocument(ctx, ctx.params.id!);
  return { data: await loadAdminData(ctx.db, ctx.schoolId) };
});
