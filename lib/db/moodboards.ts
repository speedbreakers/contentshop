import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
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
  const rows = await db
    .select({
      id: moodboardAssets.id,
      moodboardId: moodboardAssets.moodboardId,
      uploadedFileId: moodboardAssets.uploadedFileId,
      sortOrder: moodboardAssets.sortOrder,
      createdAt: moodboardAssets.createdAt,
      blobUrl: uploadedFiles.blobUrl,
      originalName: uploadedFiles.originalName,
      contentType: uploadedFiles.contentType,
      size: uploadedFiles.size,
    })
    .from(moodboardAssets)
    .innerJoin(uploadedFiles, eq(uploadedFiles.id, moodboardAssets.uploadedFileId))
    .where(and(eq(moodboardAssets.teamId, teamId), eq(moodboardAssets.moodboardId, moodboardId)))
    .orderBy(asc(moodboardAssets.sortOrder), asc(moodboardAssets.id));
  return rows;
}

export async function addMoodboardAssets(teamId: number, moodboardId: number, uploadedFileIds: number[]) {
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
        sortOrder: idx,
        createdAt: now,
      }))
    )
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



