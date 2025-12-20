import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle';
import { moodboardAssets, moodboards, uploadedFiles } from './schema';

export type MoodboardStyleProfile = Record<string, unknown>;

export async function listMoodboards(teamId: number) {
  const rows = await db
    .select({
      id: moodboards.id,
      teamId: moodboards.teamId,
      name: moodboards.name,
      description: moodboards.description,
      styleProfile: moodboards.styleProfile,
      createdAt: moodboards.createdAt,
      updatedAt: moodboards.updatedAt,
      assetsCount: sql<number>`count(${moodboardAssets.id})`.mapWith(Number),
    })
    .from(moodboards)
    .leftJoin(moodboardAssets, eq(moodboardAssets.moodboardId, moodboards.id))
    .where(and(eq(moodboards.teamId, teamId), isNull(moodboards.deletedAt)))
    .groupBy(moodboards.id)
    .orderBy(desc(moodboards.updatedAt));

  return rows;
}

export async function listMoodboardAssetPreviews(
  teamId: number,
  moodboardIds: number[],
  perMoodboard = 4
) {
  const ids = Array.from(new Set(moodboardIds.filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      moodboardId: moodboardAssets.moodboardId,
      uploadedFileId: moodboardAssets.uploadedFileId,
      sortOrder: moodboardAssets.sortOrder,
      assetId: moodboardAssets.id,
      originalName: uploadedFiles.originalName,
      contentType: uploadedFiles.contentType,
    })
    .from(moodboardAssets)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, moodboardAssets.uploadedFileId))
    .where(and(eq(moodboardAssets.teamId, teamId), inArray(moodboardAssets.moodboardId, ids)))
    .orderBy(asc(moodboardAssets.moodboardId), asc(moodboardAssets.sortOrder), asc(moodboardAssets.id));

  const per = Math.max(0, Math.min(12, Math.floor(perMoodboard)));
  const out: Array<{
    moodboardId: number;
    uploadedFileId: number;
    originalName: string | null;
    contentType: string | null;
  }> = [];

  const counts = new Map<number, number>();
  for (const r of rows) {
    const mid = Number(r.moodboardId);
    const count = counts.get(mid) ?? 0;
    if (count >= per) continue;
    counts.set(mid, count + 1);
    out.push({
      moodboardId: mid,
      uploadedFileId: Number(r.uploadedFileId),
      originalName: (r.originalName as any) ?? null,
      contentType: (r.contentType as any) ?? null,
    });
  }

  return out;
}

export async function getMoodboardById(teamId: number, id: number) {
  const row = await db.query.moodboards.findFirst({
    where: and(eq(moodboards.teamId, teamId), eq(moodboards.id, id), isNull(moodboards.deletedAt)),
  });
  return row ?? null;
}

export async function createMoodboard(teamId: number, input: { name: string; description?: string | null; styleProfile: MoodboardStyleProfile }) {
  const now = new Date();
  const [row] = await db
    .insert(moodboards)
    .values({
      teamId,
      name: input.name,
      description: input.description ?? null,
      styleProfile: input.styleProfile ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row ?? null;
}

export async function updateMoodboard(teamId: number, id: number, input: { name?: string; description?: string | null; styleProfile?: MoodboardStyleProfile }) {
  const now = new Date();
  const [row] = await db
    .update(moodboards)
    .set({
      ...(typeof input.name === 'string' ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.styleProfile !== undefined ? { styleProfile: input.styleProfile } : {}),
      updatedAt: now,
    })
    .where(and(eq(moodboards.teamId, teamId), eq(moodboards.id, id), isNull(moodboards.deletedAt)))
    .returning();
  return row ?? null;
}

export async function softDeleteMoodboard(teamId: number, id: number) {
  const now = new Date();
  const [row] = await db
    .update(moodboards)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(moodboards.teamId, teamId), eq(moodboards.id, id), isNull(moodboards.deletedAt)))
    .returning();
  return row ?? null;
}

export async function listMoodboardAssets(teamId: number, moodboardId: number) {
  return await listMoodboardAssetsByKind(teamId, moodboardId, 'all');
}

export type MoodboardAssetKind = 'background' | 'model' | 'reference_positive' | 'reference_negative';

export async function listMoodboardAssetsByKind(
  teamId: number,
  moodboardId: number,
  kind: MoodboardAssetKind | 'all' = 'all'
) {
  const rows = await db
    .select({
      id: moodboardAssets.id,
      moodboardId: moodboardAssets.moodboardId,
      uploadedFileId: moodboardAssets.uploadedFileId,
      kind: moodboardAssets.kind,
      sortOrder: moodboardAssets.sortOrder,
      createdAt: moodboardAssets.createdAt,
      blobUrl: uploadedFiles.blobUrl,
      originalName: uploadedFiles.originalName,
      contentType: uploadedFiles.contentType,
      size: uploadedFiles.size,
    })
    .from(moodboardAssets)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, moodboardAssets.uploadedFileId))
    .where(
      and(
        eq(moodboardAssets.teamId, teamId),
        eq(moodboardAssets.moodboardId, moodboardId),
        kind === 'all' ? sql`true` : eq(moodboardAssets.kind, kind)
      )
    )
    .orderBy(asc(moodboardAssets.sortOrder), asc(moodboardAssets.id));
  return rows;
}

export async function addMoodboardAssets(teamId: number, moodboardId: number, uploadedFileIds: number[]) {
  return await addMoodboardAssetsWithKind(teamId, moodboardId, uploadedFileIds, 'reference_positive');
}

export async function addMoodboardAssetsWithKind(
  teamId: number,
  moodboardId: number,
  uploadedFileIds: number[],
  kind: MoodboardAssetKind
) {
  const ids = Array.from(new Set(uploadedFileIds.filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return [];
  const now = new Date();

  const inserted = await db
    .insert(moodboardAssets)
    .values(
      ids.map((fid, idx) => ({
        teamId,
        moodboardId,
        uploadedFileId: fid,
        kind,
        sortOrder: idx,
        createdAt: now,
      }))
    )
    // With the unique index on (moodboard_id, uploaded_file_id, kind), this only skips exact duplicates
    // within the same section, while allowing the same file to exist in multiple sections.
    .onConflictDoNothing()
    .returning();
  return inserted;
}

export async function removeMoodboardAsset(teamId: number, moodboardId: number, assetId: number) {
  const [row] = await db
    .delete(moodboardAssets)
    .where(and(eq(moodboardAssets.teamId, teamId), eq(moodboardAssets.moodboardId, moodboardId), eq(moodboardAssets.id, assetId)))
    .returning();
  return row ?? null;
}



