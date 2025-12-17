import { and, desc, eq, inArray, sql, ne } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { batches, generationJobs, products, productVariants, sets } from '@/lib/db/schema';

export type BatchStatus = 'queued' | 'running' | 'paused' | 'success' | 'failed' | 'canceled';

export async function createBatch(teamId: number, input: {
  name: string;
  status?: BatchStatus;
  settings?: any;
  variantCount: number;
  imageCount: number;
  folderId: number | null;
}) {
  const now = new Date();
  const [row] = await db
    .insert(batches)
    .values({
      teamId,
      name: input.name,
      status: input.status ?? 'queued',
      settings: input.settings ?? null,
      variantCount: input.variantCount,
      imageCount: input.imageCount,
      folderId: input.folderId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row ?? null;
}

export async function getBatchById(teamId: number, batchId: number) {
  const row = await db.query.batches.findFirst({
    where: and(eq(batches.teamId, teamId), eq(batches.id, batchId)),
  });
  return row ?? null;
}

export async function updateBatchStatus(teamId: number, batchId: number, status: BatchStatus) {
  const now = new Date();
  const [row] = await db
    .update(batches)
    .set({ status, updatedAt: now })
    .where(and(eq(batches.teamId, teamId), eq(batches.id, batchId)))
    .returning();
  return row ?? null;
}

export async function listBatches(teamId: number, limit: number = 50) {
  return await db
    .select()
    .from(batches)
    .where(and(eq(batches.teamId, teamId), ne(batches.status, 'canceled')))
    .orderBy(desc(batches.createdAt))
    .limit(limit);
}

export async function aggregateBatchJobStatus(teamId: number, batchId: number) {
  const rows = await db
    .select({
      status: generationJobs.status,
      count: sql<number>`count(*)`,
    })
    .from(generationJobs)
    .where(and(eq(generationJobs.teamId, teamId), eq(generationJobs.batchId, batchId)))
    .groupBy(generationJobs.status);

  const out = { queued: 0, running: 0, success: 0, failed: 0, canceled: 0 };
  for (const r of rows) {
    const key = String(r.status) as keyof typeof out;
    if (key in out) out[key] = Number(r.count ?? 0);
  }
  return out;
}

export async function getBatchJobsWithVariantInfo(teamId: number, batchId: number) {
  // Join jobs -> variant -> product, so the UI can render a meaningful list.
  return await db
    .select({
      job: generationJobs,
      variant: {
        id: productVariants.id,
        title: productVariants.title,
        imageUrl: productVariants.imageUrl,
      },
      product: {
        id: products.id,
        title: products.title,
      },
    })
    .from(generationJobs)
    .innerJoin(productVariants, eq(productVariants.id, generationJobs.variantId))
    .innerJoin(products, eq(products.id, generationJobs.productId))
    .where(and(eq(generationJobs.teamId, teamId), eq(generationJobs.batchId, batchId)))
    .orderBy(desc(generationJobs.createdAt));
}

export async function getSharedBatchFolder(teamId: number, batchId: number) {
  const row = await db.query.sets.findFirst({
    where: and(eq(sets.teamId, teamId), eq(sets.batchId, batchId), eq(sets.scopeType, 'batch' as any)),
  });
  return row ?? null;
}


