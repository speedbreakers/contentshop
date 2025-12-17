/**
 * Generation Jobs DB Access Layer
 *
 * CRUD operations for generation_jobs table (background job queue for image generation).
 */

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { generationJobs } from '@/lib/db/schema';

export type GenerationJobType = 'image_generation' | 'image_edit';
export type GenerationJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';

export interface GenerationJobProgress {
  current: number;
  total: number;
  completedImageIds?: number[];
}

export interface GenerationJobMetadata {
  schemaKey?: string;
  input?: Record<string, unknown>;
  numberOfVariations?: number;
  prompt?: string;
  prompts?: string[]; // Support for per-variation prompts
  moodboardId?: number | null;
  requestOrigin?: string;
  authCookie?: string | null;
  productTitle?: string;
  productCategory?: string;
  extraReferenceImageUrls?: string[];
  zipUrl?: string;
  creditsId?: number;
  isOverage?: boolean;
  [key: string]: unknown;
}

export interface CreateGenerationJobInput {
  productId: number;
  variantId: number;
  type: GenerationJobType;
  metadata?: GenerationJobMetadata;
}

export interface UpdateGenerationJobInput {
  generationId?: number | null;
  status?: GenerationJobStatus;
  progress?: GenerationJobProgress | null;
  error?: string | null;
  metadata?: GenerationJobMetadata | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

/**
 * List generation jobs for a team
 */
export async function listGenerationJobs(
  teamId: number,
  options?: { variantId?: number; status?: GenerationJobStatus; limit?: number }
) {
  const { variantId, status, limit = 50 } = options ?? {};

  const conditions = [eq(generationJobs.teamId, teamId)];
  
  if (variantId !== undefined) {
    conditions.push(eq(generationJobs.variantId, variantId));
  }
  if (status !== undefined) {
    conditions.push(eq(generationJobs.status, status));
  }

  return await db
    .select()
    .from(generationJobs)
    .where(and(...conditions))
    .orderBy(desc(generationJobs.createdAt))
    .limit(limit);
}

/**
 * Get a generation job by ID
 */
export async function getGenerationJobById(teamId: number, id: number) {
  const row = await db.query.generationJobs.findFirst({
    where: and(eq(generationJobs.teamId, teamId), eq(generationJobs.id, id)),
  });
  return row ?? null;
}

/**
 * Get the most recent generation job for a variant
 */
export async function getLatestGenerationJobForVariant(
  teamId: number,
  variantId: number,
  type?: GenerationJobType
) {
  const conditions = [
    eq(generationJobs.teamId, teamId),
    eq(generationJobs.variantId, variantId),
  ];
  if (type) {
    conditions.push(eq(generationJobs.type, type));
  }

  const row = await db.query.generationJobs.findFirst({
    where: and(...conditions),
    orderBy: desc(generationJobs.createdAt),
  });
  return row ?? null;
}

/**
 * Create a new generation job
 */
export async function createGenerationJob(teamId: number, input: CreateGenerationJobInput) {
  const now = new Date();

  const [row] = await db
    .insert(generationJobs)
    .values({
      teamId,
      productId: input.productId,
      variantId: input.variantId,
      type: input.type,
      status: 'queued',
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ?? null;
}

/**
 * Update a generation job
 */
export async function updateGenerationJob(
  teamId: number,
  id: number,
  input: UpdateGenerationJobInput
) {
  const now = new Date();

  const setValues: Record<string, unknown> = { updatedAt: now };
  
  if (input.generationId !== undefined) setValues.generationId = input.generationId;
  if (input.status !== undefined) setValues.status = input.status;
  if (input.progress !== undefined) setValues.progress = input.progress;
  if (input.error !== undefined) setValues.error = input.error;
  if (input.metadata !== undefined) setValues.metadata = input.metadata;
  if (input.startedAt !== undefined) setValues.startedAt = input.startedAt;
  if (input.completedAt !== undefined) setValues.completedAt = input.completedAt;

  const [row] = await db
    .update(generationJobs)
    .set(setValues)
    .where(and(eq(generationJobs.teamId, teamId), eq(generationJobs.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Update job progress (for incremental updates during processing)
 */
export async function updateGenerationJobProgress(
  teamId: number,
  id: number,
  progress: GenerationJobProgress
) {
  return await updateGenerationJob(teamId, id, { progress });
}

/**
 * Update job metadata (e.g., to add zipUrl after completion)
 */
export async function updateGenerationJobMetadata(
  teamId: number,
  id: number,
  metadata: GenerationJobMetadata
) {
  return await updateGenerationJob(teamId, id, { metadata });
}

/**
 * Mark a generation job as running
 */
export async function markGenerationJobRunning(teamId: number, id: number) {
  return await updateGenerationJob(teamId, id, {
    status: 'running',
    startedAt: new Date(),
  });
}

/**
 * Mark a generation job as success
 */
export async function markGenerationJobSuccess(
  teamId: number,
  id: number,
  generationId: number,
  progress?: GenerationJobProgress
) {
  return await updateGenerationJob(teamId, id, {
    status: 'success',
    generationId,
    completedAt: new Date(),
    ...(progress ? { progress } : {}),
  });
}

/**
 * Mark a generation job as failed
 */
export async function markGenerationJobFailed(teamId: number, id: number, error: string) {
  return await updateGenerationJob(teamId, id, {
    status: 'failed',
    error,
    completedAt: new Date(),
  });
}

/**
 * Get queued generation jobs for processing (used by cron worker)
 */
export async function getQueuedGenerationJobs(limit: number = 3) {
  return await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.status, 'queued'))
    .orderBy(asc(generationJobs.createdAt))
    .limit(limit);
}

/**
 * Get running generation jobs (for health checks / stuck job detection)
 */
export async function getRunningGenerationJobs() {
  return await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.status, 'running'))
    .orderBy(asc(generationJobs.startedAt));
}

/**
 * Cancel pending generation jobs for a variant
 */
export async function cancelPendingGenerationJobsForVariant(
  teamId: number,
  variantId: number
) {
  const now = new Date();

  return await db
    .update(generationJobs)
    .set({
      status: 'canceled',
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(generationJobs.teamId, teamId),
        eq(generationJobs.variantId, variantId),
        inArray(generationJobs.status, ['queued', 'running'])
      )
    )
    .returning();
}

/**
 * Check if there's an active generation job for a variant
 */
export async function hasActiveGenerationJob(
  teamId: number,
  variantId: number,
  type?: GenerationJobType
): Promise<boolean> {
  const conditions = [
    eq(generationJobs.teamId, teamId),
    eq(generationJobs.variantId, variantId),
    inArray(generationJobs.status, ['queued', 'running']),
  ];
  if (type) {
    conditions.push(eq(generationJobs.type, type));
  }

  const row = await db.query.generationJobs.findFirst({
    where: and(...conditions),
  });
  return row !== null && row !== undefined;
}

/**
 * Count active generation jobs for a team (for rate limiting)
 */
export async function countActiveGenerationJobsForTeam(teamId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.teamId, teamId),
        inArray(generationJobs.status, ['queued', 'running'])
      )
    );
  return Number(result[0]?.count ?? 0);
}

