/**
 * Commerce Links DB Access Layer
 *
 * CRUD operations for product_links and variant_links tables.
 * Links canonical ContentShop products/variants to external store listings.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { productLinks, variantLinks } from '@/lib/db/schema';
import type { CommerceProvider, LinkStatus } from './providers/types';

// ============================================================================
// Product Links
// ============================================================================

export interface CreateProductLinkInput {
  productId: number;
  accountId: number;
  provider: CommerceProvider;
  externalProductId: string;
}

/**
 * List product links for a canonical product
 */
export async function listProductLinksByProduct(teamId: number, productId: number) {
  return await db
    .select()
    .from(productLinks)
    .where(and(eq(productLinks.teamId, teamId), eq(productLinks.productId, productId)))
    .orderBy(desc(productLinks.createdAt));
}

/**
 * List product links for an account
 */
export async function listProductLinksByAccount(teamId: number, accountId: number) {
  return await db
    .select()
    .from(productLinks)
    .where(and(eq(productLinks.teamId, teamId), eq(productLinks.accountId, accountId)))
    .orderBy(desc(productLinks.createdAt));
}

/**
 * Get product link by ID
 */
export async function getProductLinkById(teamId: number, id: number) {
  const row = await db.query.productLinks.findFirst({
    where: and(eq(productLinks.teamId, teamId), eq(productLinks.id, id)),
  });
  return row ?? null;
}

/**
 * Get product link by external product ID
 * (to find canonical product for an external product)
 */
export async function getProductLinkByExternalId(
  accountId: number,
  externalProductId: string
) {
  const row = await db.query.productLinks.findFirst({
    where: and(
      eq(productLinks.accountId, accountId),
      eq(productLinks.externalProductId, externalProductId)
    ),
  });
  return row ?? null;
}

/**
 * Create a product link
 */
export async function createProductLink(teamId: number, input: CreateProductLinkInput) {
  const now = new Date();

  const [row] = await db
    .insert(productLinks)
    .values({
      teamId,
      productId: input.productId,
      accountId: input.accountId,
      provider: input.provider,
      externalProductId: input.externalProductId,
      status: 'linked',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ?? null;
}

/**
 * Update product link status
 */
export async function updateProductLinkStatus(
  teamId: number,
  id: number,
  status: LinkStatus
) {
  const now = new Date();

  const [row] = await db
    .update(productLinks)
    .set({ status, updatedAt: now })
    .where(and(eq(productLinks.teamId, teamId), eq(productLinks.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Mark product links as broken (for webhook handler)
 */
export async function markProductLinksBroken(
  accountId: number,
  externalProductId: string
) {
  const now = new Date();

  return await db
    .update(productLinks)
    .set({ status: 'broken', updatedAt: now })
    .where(
      and(
        eq(productLinks.accountId, accountId),
        eq(productLinks.externalProductId, externalProductId)
      )
    )
    .returning();
}

/**
 * Delete product link (unlink)
 */
export async function deleteProductLink(teamId: number, id: number) {
  const [row] = await db
    .delete(productLinks)
    .where(and(eq(productLinks.teamId, teamId), eq(productLinks.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Delete all product links for a canonical product
 */
export async function deleteAllProductLinksForProduct(teamId: number, productId: number) {
  return await db
    .delete(productLinks)
    .where(
      and(
        eq(productLinks.teamId, teamId),
        eq(productLinks.productId, productId)
      )
    )
    .returning();
}

/**
 * Check if canonical product has any linked stores
 */
export async function hasLinkedStores(
  teamId: number,
  productId: number
): Promise<boolean> {
  const row = await db.query.productLinks.findFirst({
    where: and(
      eq(productLinks.teamId, teamId),
      eq(productLinks.productId, productId),
      eq(productLinks.status, 'linked')
    ),
  });
  return row !== null && row !== undefined;
}

// ============================================================================
// Variant Links
// ============================================================================

export interface CreateVariantLinkInput {
  variantId: number;
  accountId: number;
  provider: CommerceProvider;
  externalProductId: string;
  externalVariantId: string;
}

/**
 * List variant links for a canonical variant
 */
export async function listVariantLinksByVariant(teamId: number, variantId: number) {
  return await db
    .select()
    .from(variantLinks)
    .where(and(eq(variantLinks.teamId, teamId), eq(variantLinks.variantId, variantId)))
    .orderBy(desc(variantLinks.createdAt));
}

/**
 * List variant links for an account
 */
export async function listVariantLinksByAccount(teamId: number, accountId: number) {
  return await db
    .select()
    .from(variantLinks)
    .where(and(eq(variantLinks.teamId, teamId), eq(variantLinks.accountId, accountId)))
    .orderBy(desc(variantLinks.createdAt));
}

/**
 * List variant links for an external product
 */
export async function listVariantLinksByExternalProduct(
  accountId: number,
  externalProductId: string
) {
  return await db
    .select()
    .from(variantLinks)
    .where(
      and(
        eq(variantLinks.accountId, accountId),
        eq(variantLinks.externalProductId, externalProductId)
      )
    )
    .orderBy(desc(variantLinks.createdAt));
}

/**
 * Get variant link by ID
 */
export async function getVariantLinkById(teamId: number, id: number) {
  const row = await db.query.variantLinks.findFirst({
    where: and(eq(variantLinks.teamId, teamId), eq(variantLinks.id, id)),
  });
  return row ?? null;
}

/**
 * Get variant link by external variant ID
 */
export async function getVariantLinkByExternalId(
  accountId: number,
  externalVariantId: string
) {
  const row = await db.query.variantLinks.findFirst({
    where: and(
      eq(variantLinks.accountId, accountId),
      eq(variantLinks.externalVariantId, externalVariantId)
    ),
  });
  return row ?? null;
}

/**
 * Create a variant link
 */
export async function createVariantLink(teamId: number, input: CreateVariantLinkInput) {
  const now = new Date();

  const [row] = await db
    .insert(variantLinks)
    .values({
      teamId,
      variantId: input.variantId,
      accountId: input.accountId,
      provider: input.provider,
      externalProductId: input.externalProductId,
      externalVariantId: input.externalVariantId,
      status: 'linked',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ?? null;
}

/**
 * Bulk create variant links (for linking all variants of a product)
 */
export async function bulkCreateVariantLinks(
  teamId: number,
  links: CreateVariantLinkInput[]
) {
  const results = [];
  for (const link of links) {
    const result = await createVariantLink(teamId, link);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Update variant link status
 */
export async function updateVariantLinkStatus(
  teamId: number,
  id: number,
  status: LinkStatus
) {
  const now = new Date();

  const [row] = await db
    .update(variantLinks)
    .set({ status, updatedAt: now })
    .where(and(eq(variantLinks.teamId, teamId), eq(variantLinks.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Mark variant links as broken by external product
 */
export async function markVariantLinksBroken(
  accountId: number,
  externalProductId: string
) {
  const now = new Date();

  return await db
    .update(variantLinks)
    .set({ status: 'broken', updatedAt: now })
    .where(
      and(
        eq(variantLinks.accountId, accountId),
        eq(variantLinks.externalProductId, externalProductId)
      )
    )
    .returning();
}

/**
 * Delete variant link (unlink)
 */
export async function deleteVariantLink(teamId: number, id: number) {
  const [row] = await db
    .delete(variantLinks)
    .where(and(eq(variantLinks.teamId, teamId), eq(variantLinks.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Delete all variant links for a canonical variant
 */
export async function deleteAllVariantLinksForVariant(teamId: number, variantId: number) {
  return await db
    .delete(variantLinks)
    .where(
      and(
        eq(variantLinks.teamId, teamId),
        eq(variantLinks.variantId, variantId)
      )
    )
    .returning();
}

/**
 * Get linked external variants for a canonical variant
 * (used to determine publish targets)
 */
export async function getLinkedExternalVariants(teamId: number, variantId: number) {
  return await db
    .select()
    .from(variantLinks)
    .where(
      and(
        eq(variantLinks.teamId, teamId),
        eq(variantLinks.variantId, variantId),
        eq(variantLinks.status, 'linked')
      )
    );
}

/**
 * Count linked variants for a canonical variant
 */
export async function countLinkedVariants(
  teamId: number,
  variantId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(variantLinks)
    .where(
      and(
        eq(variantLinks.teamId, teamId),
        eq(variantLinks.variantId, variantId),
        eq(variantLinks.status, 'linked')
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Check if external variant is already linked
 */
export async function isExternalVariantLinked(
  accountId: number,
  externalVariantId: string
): Promise<boolean> {
  const row = await db.query.variantLinks.findFirst({
    where: and(
      eq(variantLinks.accountId, accountId),
      eq(variantLinks.externalVariantId, externalVariantId),
      eq(variantLinks.status, 'linked')
    ),
  });
  return row !== null && row !== undefined;
}

