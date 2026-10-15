import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { toApiError } from "@/server/http/errors";
import { MAX_UPLOAD_BYTES, storageMode, writeLocal } from "@/server/storage";

/**
 * PUT /api/admin/uploads?key=… — development stand-in for the signed
 * Supabase Storage upload URL. Disabled whenever real storage is configured.
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    if (storageMode() !== "local" || process.env.NODE_ENV === "production") {
      return new Response(null, { status: 404 });
    }
    const session = await requireSession("admin");
    const key = request.nextUrl.searchParams.get("key") ?? "";
    if (!key.startsWith(`${session.schoolId}/`)) return new Response(null, { status: 403 });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) return new Response(null, { status: 413 });
    await writeLocal(key, bytes);
    return new Response(null, { status: 200 });
  } catch (error) {
    const api = toApiError(error);
    return Response.json({ error: { code: api.code, message: api.message } }, { status: api.status });
  }
}
