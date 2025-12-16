/**
 * Asset Publications DB Access Layer
 *
 * CRUD operations for asset_publications table.
 * Tracks publish history of generated images to external variants.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { assetPublications } from '@/lib/db/schema';
import type { CommerceProvider, PublishStatus } from './providers/types';

export interface CreatePublicationInput {
  accountId: number;
  provider: CommerceProvider;
  productId?: number;
  variantId?: number;
  variantImageId: number;
  externalProductId: string;
  externalVariantId: string;
}

export interface UpdatePublicationInput {
  status?: PublishStatus;
  remoteMediaId?: string | null;
  remoteResourceVersion?: string | null;
  error?: string | null;
  attempts?: number;
}

/**
 * List publications for a team
 */
export async function listPublications(
  teamId: number,
  options?: { accountId?: number; status?: PublishStatus; limit?: number }
) {
  const { accountId, status, limit = 50 } = options ?? {};

  const conditions = [eq(assetPublications.teamId, teamId)];

  if (accountId !== undefined) {
    conditions.push(eq(assetPublications.accountId, accountId));
  }

  if (status !== undefined) {
    conditions.push(eq(assetPublications.status, status));
  }

  return await db
    .select()
    .from(assetPublications)
    .where(and(...conditions))
    .orderBy(desc(assetPublications.createdAt))
    .limit(limit);
}

/**
 * List publications for a canonical variant
 */
export async function listPublicationsByVariant(teamId: number, variantId: number) {
  return await db
    .select()
    .from(assetPublications)
    .where(
      and(eq(assetPublications.teamId, teamId), eq(assetPublications.variantId, variantId))
    )
    .orderBy(desc(assetPublications.createdAt));
}

/**
 * List publications for a variant image
 */
export async function listPublicationsByImage(teamId: number, variantImageId: number) {
  return await db
    .select()
    .from(assetPublications)
    .where(
      and(
        eq(assetPublications.teamId, teamId),
        eq(assetPublications.variantImageId, variantImageId)
      )
    )
    .orderBy(desc(assetPublications.createdAt));
}

/**
 * Get publication by ID
 */
export async function getPublicationById(teamId: number, id: number) {
  const row = await db.query.assetPublications.findFirst({
    where: and(eq(assetPublications.teamId, teamId), eq(assetPublications.id, id)),
  });
  return row ?? null;
}

/**
 * Get latest publication for an image to a specific external variant
 */
export async function getLatestPublicationForExternalVariant(
  teamId: number,
  variantImageId: number,
  accountId: number,
  externalVariantId: string
) {
  const row = await db.query.assetPublications.findFirst({
    where: and(
      eq(assetPublications.teamId, teamId),
      eq(assetPublications.variantImageId, variantImageId),
      eq(assetPublications.accountId, accountId),
      eq(assetPublications.externalVariantId, externalVariantId)
    ),
    orderBy: desc(assetPublications.createdAt),
  });
  return row ?? null;
}

/**
 * Create a publication record
 */
export async function createPublication(
  teamId: number,
  input: CreatePublicationInput
) {
  const now = new Date();

  const [row] = await db
    .insert(assetPublications)
    .values({
      teamId,
      accountId: input.accountId,
      provider: input.provider,
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      variantImageId: input.variantImageId,
      externalProductId: input.externalProductId,
      externalVariantId: input.externalVariantId,
      status: 'pending',
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ?? null;
}

/**
 * Update publication
 */
export async function updatePublication(
  teamId: number,
  id: number,
  input: UpdatePublicationInput
) {
  const now = new Date();

  const [row] = await db
    .update(assetPublications)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.remoteMediaId !== undefined ? { remoteMediaId: input.remoteMediaId } : {}),
      ...(input.remoteResourceVersion !== undefined
        ? { remoteResourceVersion: input.remoteResourceVersion }
        : {}),
      ...(input.error !== undefined ? { error: input.error } : {}),
      ...(input.attempts !== undefined ? { attempts: input.attempts } : {}),
      updatedAt: now,
    })
    .where(and(eq(assetPublications.teamId, teamId), eq(assetPublications.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Mark publication as success
 */
export async function markPublicationSuccess(
  teamId: number,
  id: number,
  remoteMediaId: string,
  remoteResourceVersion?: string
) {
  return await updatePublication(teamId, id, {
    status: 'success',
    remoteMediaId,
    remoteResourceVersion: remoteResourceVersion ?? null,
    error: null,
  });
}

/**
 * Mark publication as failed
 */
export async function markPublicationFailed(
  teamId: number,
  id: number,
  error: string
) {
  // Get current attempts count
  const publication = await getPublicationById(teamId, id);
  const currentAttempts = publication?.attempts ?? 1;

  return await updatePublication(teamId, id, {
    status: 'failed',
    error,
    attempts: currentAttempts + 1,
  });
}

/**
 * Get failed publications for retry (used by cron)
 */
export async function getFailedPublicationsForRetry(
  maxAttempts: number = 3,
  limit: number = 20
) {
  return await db
    .select()
    .from(assetPublications)
    .where(
      and(
        eq(assetPublications.status, 'failed'),
        sql`${assetPublications.attempts} < ${maxAttempts}`
      )
    )
    .orderBy(assetPublications.updatedAt)
    .limit(limit);
}

/**
 * Get pending publications (for job processing)
 */
export async function getPendingPublications(limit: number = 20) {
  return await db
    .select()
    .from(assetPublications)
    .where(eq(assetPublications.status, 'pending'))
    .orderBy(assetPublications.createdAt)
    .limit(limit);
}

/**
 * Delete publication
 */
export async function deletePublication(teamId: number, id: number) {
  const [row] = await db
    .delete(assetPublications)
    .where(and(eq(assetPublications.teamId, teamId), eq(assetPublications.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Check if image has been published to an external variant
 */
export async function isImagePublishedToExternalVariant(
  teamId: number,
  variantImageId: number,
  accountId: number,
  externalVariantId: string
): Promise<boolean> {
  const row = await db.query.assetPublications.findFirst({
    where: and(
      eq(assetPublications.teamId, teamId),
      eq(assetPublications.variantImageId, variantImageId),
      eq(assetPublications.accountId, accountId),
      eq(assetPublications.externalVariantId, externalVariantId),
      eq(assetPublications.status, 'success')
    ),
  });
  return row !== null && row !== undefined;
}

/**
 * Count successful publications for an account
 */
export async function countSuccessfulPublications(
  teamId: number,
  accountId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(assetPublications)
    .where(
      and(
        eq(assetPublications.teamId, teamId),
        eq(assetPublications.accountId, accountId),
        eq(assetPublications.status, 'success')
      )
    );
  return result[0]?.count ?? 0;
}

