/**
 * Commerce Accounts DB Access Layer
 *
 * CRUD operations for commerce_accounts table.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { commerceAccounts } from '@/lib/db/schema';
import type { CommerceProvider, AccountStatus } from './providers/types';

export interface CreateCommerceAccountInput {
  provider: CommerceProvider;
  displayName: string;
  // Shopify-specific
  shopDomain?: string;
  accessToken?: string;
  scopes?: string;
}

export interface UpdateCommerceAccountInput {
  displayName?: string;
  status?: AccountStatus;
  accessToken?: string;
  scopes?: string;
  appUninstalledAt?: Date | null;
}

/**
 * List all commerce accounts for a team
 */
export async function listCommerceAccounts(teamId: number) {
  return await db
    .select()
    .from(commerceAccounts)
    .where(and(eq(commerceAccounts.teamId, teamId), isNull(commerceAccounts.deletedAt)))
    .orderBy(desc(commerceAccounts.createdAt));
}

/**
 * List commerce accounts by provider
 */
export async function listCommerceAccountsByProvider(
  teamId: number,
  provider: CommerceProvider
) {
  return await db
    .select()
    .from(commerceAccounts)
    .where(
      and(
        eq(commerceAccounts.teamId, teamId),
        eq(commerceAccounts.provider, provider),
        isNull(commerceAccounts.deletedAt)
      )
    )
    .orderBy(desc(commerceAccounts.createdAt));
}

/**
 * Get a commerce account by ID
 */
export async function getCommerceAccountById(teamId: number, id: number) {
  const row = await db.query.commerceAccounts.findFirst({
    where: and(
      eq(commerceAccounts.teamId, teamId),
      eq(commerceAccounts.id, id),
      isNull(commerceAccounts.deletedAt)
    ),
  });
  return row ?? null;
}

/**
 * Get a commerce account by shop domain (Shopify-specific)
 */
export async function getCommerceAccountByShopDomain(shopDomain: string) {
  const row = await db.query.commerceAccounts.findFirst({
    where: and(
      eq(commerceAccounts.shopDomain, shopDomain),
      isNull(commerceAccounts.deletedAt)
    ),
  });
  return row ?? null;
}

/**
 * Find commerce account by shop domain and team
 */
export async function findCommerceAccountByShopDomain(
  teamId: number,
  shopDomain: string
) {
  const row = await db.query.commerceAccounts.findFirst({
    where: and(
      eq(commerceAccounts.teamId, teamId),
      eq(commerceAccounts.shopDomain, shopDomain),
      isNull(commerceAccounts.deletedAt)
    ),
  });
  return row ?? null;
}

/**
 * Create a new commerce account
 */
export async function createCommerceAccount(
  teamId: number,
  input: CreateCommerceAccountInput
) {
  const now = new Date();

  const [row] = await db
    .insert(commerceAccounts)
    .values({
      teamId,
      provider: input.provider,
      displayName: input.displayName,
      status: 'connected',
      shopDomain: input.shopDomain ?? null,
      accessToken: input.accessToken ?? null,
      scopes: input.scopes ?? null,
      installedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ?? null;
}

/**
 * Update a commerce account
 */
export async function updateCommerceAccount(
  teamId: number,
  id: number,
  input: UpdateCommerceAccountInput
) {
  const now = new Date();

  const [row] = await db
    .update(commerceAccounts)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.accessToken !== undefined ? { accessToken: input.accessToken } : {}),
      ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
      ...(input.appUninstalledAt !== undefined
        ? { appUninstalledAt: input.appUninstalledAt }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(commerceAccounts.teamId, teamId),
        eq(commerceAccounts.id, id),
        isNull(commerceAccounts.deletedAt)
      )
    )
    .returning();

  return row ?? null;
}

/**
 * Disconnect a commerce account (mark as disconnected)
 */
export async function disconnectCommerceAccount(teamId: number, id: number) {
  const now = new Date();

  const [row] = await db
    .update(commerceAccounts)
    .set({
      status: 'disconnected',
      appUninstalledAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(commerceAccounts.teamId, teamId),
        eq(commerceAccounts.id, id),
        isNull(commerceAccounts.deletedAt)
      )
    )
    .returning();

  return row ?? null;
}

/**
 * Soft delete a commerce account
 */
export async function softDeleteCommerceAccount(teamId: number, id: number) {
  const now = new Date();

  const [row] = await db
    .update(commerceAccounts)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(commerceAccounts.teamId, teamId),
        eq(commerceAccounts.id, id),
        isNull(commerceAccounts.deletedAt)
      )
    )
    .returning();

  return row ?? null;
}

/**
 * Update access token (for reconnection or token refresh)
 */
export async function updateAccessToken(
  teamId: number,
  id: number,
  accessToken: string,
  scopes: string
) {
  const now = new Date();

  const [row] = await db
    .update(commerceAccounts)
    .set({
      accessToken,
      scopes,
      status: 'connected',
      appUninstalledAt: null,
      installedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(commerceAccounts.teamId, teamId),
        eq(commerceAccounts.id, id)
      )
    )
    .returning();

  return row ?? null;
}

