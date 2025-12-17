import { and, desc, eq } from 'drizzle-orm';
import { db } from './drizzle';
import { uploadedFiles } from './schema';

export type UploadKind = 'garment' | 'product' | 'model' | 'background' | 'moodboard' | 'shopify_import';

export async function listUploadedFiles(teamId: number, kind?: UploadKind) {
  const where = kind
    ? and(eq(uploadedFiles.teamId, teamId), eq(uploadedFiles.kind, kind))
    : eq(uploadedFiles.teamId, teamId);

  return await db
    .select()
    .from(uploadedFiles)
    .where(where)
    .orderBy(desc(uploadedFiles.createdAt));
}

export async function createUploadedFile(teamId: number, input: {
  kind: UploadKind;
  pathname: string;
  blobUrl: string;
  originalName?: string | null;
  contentType?: string | null;
  size?: number | null;
}) {
  const [row] = await db
    .insert(uploadedFiles)
    .values({
      teamId,
      kind: input.kind,
      pathname: input.pathname,
      blobUrl: input.blobUrl,
      originalName: input.originalName ?? null,
      contentType: input.contentType ?? null,
      size: input.size ?? null,
    })
    .returning();

  return row ?? null;
}

export async function getUploadedFileById(teamId: number, fileId: number) {
  const row = await db.query.uploadedFiles.findFirst({
    where: and(eq(uploadedFiles.teamId, teamId), eq(uploadedFiles.id, fileId)),
  });
  return row ?? null;
}


