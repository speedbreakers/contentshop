/**
 * Commerce Jobs DB Access Layer
 *
 * CRUD operations for commerce_jobs table (background job queue).
 */

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { commerceJobs } from '@/lib/db/schema';
import type { JobType, JobStatus, SyncProgress, CommerceProvider } from './providers/types';

export interface CreateJobInput {
  accountId: number;
  provider: CommerceProvider;
  type: JobType;
  metadata?: Record<string, unknown>;
}

export interface UpdateJobInput {
  status?: JobStatus;
  progress?: SyncProgress | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

/**
 * List jobs for a team
 */
export async function listJobs(
  teamId: number,
  options?: { accountId?: number; status?: JobStatus; limit?: number }
) {
  const { accountId, status, limit = 50 } = options ?? {};

  const conditions = [eq(commerceJobs.teamId, teamId)];

  if (accountId !== undefined) {
    conditions.push(eq(commerceJobs.accountId, accountId));
  }
  if (status !== undefined) {
    conditions.push(eq(commerceJobs.status, status));
  }

  return await db
    .select()
    .from(commerceJobs)
    .where(and(...conditions))
    .orderBy(desc(commerceJobs.createdAt))
    .limit(limit);
}

/**
 * Get a job by ID
 */
export async function getJobById(teamId: number, id: number) {
  const row = await db.query.commerceJobs.findFirst({
    where: and(eq(commerceJobs.teamId, teamId), eq(commerceJobs.id, id)),
  });
  return row ?? null;
}

/**
 * Get the most recent job of a specific type for an account
 */
export async function getLatestJobByType(
  teamId: number,
  accountId: number,
  type: JobType
) {
  const row = await db.query.commerceJobs.findFirst({
    where: and(
      eq(commerceJobs.teamId, teamId),
      eq(commerceJobs.accountId, accountId),
      eq(commerceJobs.type, type)
    ),
    orderBy: desc(commerceJobs.createdAt),
  });
  return row ?? null;
}

/**
 * Create a new job
 */
export async function createJob(teamId: number, input: CreateJobInput) {
  const now = new Date();

  const [row] = await db
    .insert(commerceJobs)
    .values({
      teamId,
      accountId: input.accountId,
      provider: input.provider,
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
 * Update a job
 */
export async function updateJob(
  teamId: number,
  id: number,
  input: UpdateJobInput
) {
  const now = new Date();

  const [row] = await db
    .update(commerceJobs)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.error !== undefined ? { error: input.error } : {}),
      ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      updatedAt: now,
    })
    .where(and(eq(commerceJobs.teamId, teamId), eq(commerceJobs.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Mark a job as running
 */
export async function markJobRunning(teamId: number, id: number) {
  return await updateJob(teamId, id, {
    status: 'running',
    startedAt: new Date(),
  });
}

/**
 * Mark a job as success
 */
export async function markJobSuccess(
  teamId: number,
  id: number,
  progress?: SyncProgress
) {
  return await updateJob(teamId, id, {
    status: 'success',
    completedAt: new Date(),
    ...(progress ? { progress } : {}),
  });
}

/**
 * Mark a job as failed
 */
export async function markJobFailed(teamId: number, id: number, error: string) {
  return await updateJob(teamId, id, {
    status: 'failed',
    error,
    completedAt: new Date(),
  });
}

/**
 * Get queued jobs for processing (used by cron worker)
 */
export async function getQueuedJobs(limit: number = 5) {
  return await db
    .select()
    .from(commerceJobs)
    .where(eq(commerceJobs.status, 'queued'))
    .orderBy(asc(commerceJobs.createdAt))
    .limit(limit);
}

/**
 * Get running jobs (for health checks / stuck job detection)
 */
export async function getRunningJobs() {
  return await db
    .select()
    .from(commerceJobs)
    .where(eq(commerceJobs.status, 'running'))
    .orderBy(asc(commerceJobs.startedAt));
}

/**
 * Cancel pending jobs for an account
 */
export async function cancelPendingJobsForAccount(
  teamId: number,
  accountId: number
) {
  const now = new Date();

  return await db
    .update(commerceJobs)
    .set({
      status: 'canceled',
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(commerceJobs.teamId, teamId),
        eq(commerceJobs.accountId, accountId),
        inArray(commerceJobs.status, ['queued', 'running'])
      )
    )
    .returning();
}

/**
 * Check if there's an active job of a type for an account
 */
export async function hasActiveJobOfType(
  teamId: number,
  accountId: number,
  type: JobType
): Promise<boolean> {
  const row = await db.query.commerceJobs.findFirst({
    where: and(
      eq(commerceJobs.teamId, teamId),
      eq(commerceJobs.accountId, accountId),
      eq(commerceJobs.type, type),
      inArray(commerceJobs.status, ['queued', 'running'])
    ),
  });
  return row !== null && row !== undefined;
}

