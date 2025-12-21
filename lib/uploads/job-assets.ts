import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { uploadedFiles } from '@/lib/db/schema';

/**
 * Extract the uploaded_files.id from an uploads proxy URL.
 *
 * Supported:
 * - "/api/uploads/123/file?teamId=...&exp=...&sig=..."
 * - "https://example.com/api/uploads/123/file?..."
 */
export function extractUploadFileId(url: string): number | null {
  if (!url || typeof url !== 'string') return null;
  let pathname = '';
  try {
    // Accept relative URLs by providing a dummy base.
    const u = new URL(url, 'http://localhost');
    pathname = u.pathname;
  } catch {
    return null;
  }

  const m = pathname.match(/^\/api\/uploads\/(\d+)\/file$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractUploadFileIds(urls: string[]): number[] {
  if (!Array.isArray(urls)) return [];
  const ids: number[] = [];
  for (const u of urls) {
    const id = extractUploadFileId(String(u));
    if (id) ids.push(id);
  }
  return Array.from(new Set(ids));
}

/**
 * Resolve uploaded file IDs to stable blob URLs for a team.
 * Returns URLs in the same order as requested IDs; missing IDs are omitted.
 */
export async function resolveUploadedFileBlobUrls(teamId: number, fileIds: number[]): Promise<string[]> {
  const ids = Array.from(new Set((fileIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)));
  if (ids.length === 0) return [];

  const rows = await db
    .select({ id: uploadedFiles.id, blobUrl: uploadedFiles.blobUrl })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.teamId, teamId), inArray(uploadedFiles.id, ids)));

  const byId = new Map(rows.map((r) => [r.id, r.blobUrl] as const));
  return ids.map((id) => byId.get(id)).filter(Boolean) as string[];
}


