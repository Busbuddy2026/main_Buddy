import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Private file storage for compliance documents (and, later, CCTV exports).
 *
 * Production: a private Supabase Storage bucket. The browser uploads straight
 * to a short-lived signed URL, so files never pass through a serverless
 * function (Vercel caps request bodies at 4.5 MB), and downloads are
 * short-lived signed URLs too.
 *
 * Development without SUPABASE_SERVICE_ROLE_KEY: files land in `.data/uploads`
 * through an authenticated API route. Never used in production.
 */

const BUCKET = "documents";
const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const storageMode = () => (supabase() ? "supabase" : "local");

/** A storage key the client cannot steer outside its school's folder. */
export function storageKey(schoolId: string, folder: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "file";
  return `${schoolId}/${folder}/${Date.now().toString(36)}-${safe}`;
}

function localPath(key: string): string {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function signedUpload(key: string): Promise<{ url: string; method: "PUT" }> {
  const client = supabase();
  if (!client) return { url: `/api/admin/uploads?key=${encodeURIComponent(key)}`, method: "PUT" };
  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`Storage upload URL failed: ${error?.message ?? "no data"}`);
  return { url: data.signedUrl, method: "PUT" };
}

/** A URL the browser can open for 60 seconds, or null for a local file. */
export async function signedDownload(key: string, fileName: string): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(key, 60, { download: fileName });
  if (error || !data) throw new Error(`Storage download URL failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

export async function writeLocal(key: string, bytes: Uint8Array): Promise<void> {
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

export async function removeObject(key: string): Promise<void> {
  const client = supabase();
  if (client) {
    await client.storage.from(BUCKET).remove([key]);
    return;
  }
  await rm(localPath(key), { force: true });
}
