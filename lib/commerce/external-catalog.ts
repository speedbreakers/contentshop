/**
 * External Catalog DB Access Layer
 *
 * CRUD operations for external_products and external_variants tables.
 * These tables mirror products/variants from external commerce stores.
 */

import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { externalProducts, externalVariants } from '@/lib/db/schema';
import type { CommerceProvider, ExternalProductData, ExternalVariantData } from './providers/types';

// ============================================================================
// External Products
// ============================================================================

export interface ListExternalProductsOptions {
  accountId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * List external products for a team
 */
export async function listExternalProducts(
  teamId: number,
  options: ListExternalProductsOptions = {}
) {
  const { accountId, search, limit = 50, offset = 0 } = options;

  const conditions = [eq(externalProducts.teamId, teamId)];

  if (accountId !== undefined) {
    conditions.push(eq(externalProducts.accountId, accountId));
  }

  if (search) {
    conditions.push(
      sql`(${externalProducts.title} ILIKE ${`%${search}%`} OR ${externalProducts.handle} ILIKE ${`%${search}%`})`
    );
  }

  return await db
    .select()
    .from(externalProducts)
    .where(and(...conditions))
    .orderBy(desc(externalProducts.updatedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get external product by ID
 */
export async function getExternalProductById(teamId: number, id: number) {
  const row = await db.query.externalProducts.findFirst({
    where: and(eq(externalProducts.teamId, teamId), eq(externalProducts.id, id)),
  });
  return row ?? null;
}

/**
 * Get external product by external ID (Shopify GID)
 */
export async function getExternalProductByExternalId(
  accountId: number,
  externalProductId: string
) {
  const row = await db.query.externalProducts.findFirst({
    where: and(
      eq(externalProducts.accountId, accountId),
      eq(externalProducts.externalProductId, externalProductId)
    ),
  });
  return row ?? null;
}

/**
 * Upsert external product (insert or update on conflict)
 */
export async function upsertExternalProduct(
  teamId: number,
  accountId: number,
  provider: CommerceProvider,
  data: ExternalProductData
) {
  const now = new Date();

  const [row] = await db
    .insert(externalProducts)
    .values({
      teamId,
      accountId,
      provider,
      externalProductId: data.externalProductId,
      title: data.title,
      handle: data.handle ?? null,
      status: data.status ?? null,
      productType: data.productType ?? null,
      vendor: data.vendor ?? null,
      tags: data.tags ?? null,
      featuredImageUrl: data.featuredImageUrl ?? null,
      raw: data.raw ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [externalProducts.accountId, externalProducts.externalProductId],
      set: {
        title: data.title,
        handle: data.handle ?? null,
        status: data.status ?? null,
        productType: data.productType ?? null,
        vendor: data.vendor ?? null,
        tags: data.tags ?? null,
        featuredImageUrl: data.featuredImageUrl ?? null,
        raw: data.raw ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return row ?? null;
}

/**
 * Bulk upsert external products
 */
export async function bulkUpsertExternalProducts(
  teamId: number,
  accountId: number,
  provider: CommerceProvider,
  products: ExternalProductData[]
) {
  const results = [];
  for (const product of products) {
    const result = await upsertExternalProduct(teamId, accountId, provider, product);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Delete external product
 */
export async function deleteExternalProduct(teamId: number, id: number) {
  const [row] = await db
    .delete(externalProducts)
    .where(and(eq(externalProducts.teamId, teamId), eq(externalProducts.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Count external products for an account
 */
export async function countExternalProducts(
  teamId: number,
  accountId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(externalProducts)
    .where(
      and(
        eq(externalProducts.teamId, teamId),
        eq(externalProducts.accountId, accountId)
      )
    );
  return result[0]?.count ?? 0;
}

// ============================================================================
// External Variants
// ============================================================================

export interface ListExternalVariantsOptions {
  accountId?: number;
  externalProductId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * List external variants for a team
 */
export async function listExternalVariants(
  teamId: number,
  options: ListExternalVariantsOptions = {}
) {
  const { accountId, externalProductId, search, limit = 100, offset = 0 } = options;

  const conditions = [eq(externalVariants.teamId, teamId)];

  if (accountId !== undefined) {
    conditions.push(eq(externalVariants.accountId, accountId));
  }

  if (externalProductId) {
    conditions.push(eq(externalVariants.externalProductId, externalProductId));
  }

  if (search) {
    conditions.push(
      sql`(${externalVariants.title} ILIKE ${`%${search}%`} OR ${externalVariants.sku} ILIKE ${`%${search}%`})`
    );
  }

  return await db
    .select()
    .from(externalVariants)
    .where(and(...conditions))
    .orderBy(desc(externalVariants.updatedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get external variant by ID
 */
export async function getExternalVariantById(teamId: number, id: number) {
  const row = await db.query.externalVariants.findFirst({
    where: and(eq(externalVariants.teamId, teamId), eq(externalVariants.id, id)),
  });
  return row ?? null;
}

/**
 * Get external variant by external ID (Shopify GID)
 */
export async function getExternalVariantByExternalId(
  accountId: number,
  externalVariantId: string
) {
  const row = await db.query.externalVariants.findFirst({
    where: and(
      eq(externalVariants.accountId, accountId),
      eq(externalVariants.externalVariantId, externalVariantId)
    ),
  });
  return row ?? null;
}

/**
 * Upsert external variant
 */
export async function upsertExternalVariant(
  teamId: number,
  accountId: number,
  provider: CommerceProvider,
  data: ExternalVariantData
) {
  const now = new Date();

  const [row] = await db
    .insert(externalVariants)
    .values({
      teamId,
      accountId,
      provider,
      externalProductId: data.externalProductId,
      externalVariantId: data.externalVariantId,
      title: data.title ?? null,
      sku: data.sku ?? null,
      price: data.price ?? null,
      selectedOptions: data.selectedOptions ?? null,
      featuredImageUrl: data.featuredImageUrl ?? null,
      raw: data.raw ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [externalVariants.accountId, externalVariants.externalVariantId],
      set: {
        title: data.title ?? null,
        sku: data.sku ?? null,
        price: data.price ?? null,
        selectedOptions: data.selectedOptions ?? null,
        featuredImageUrl: data.featuredImageUrl ?? null,
        raw: data.raw ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return row ?? null;
}

/**
 * Bulk upsert external variants
 */
export async function bulkUpsertExternalVariants(
  teamId: number,
  accountId: number,
  provider: CommerceProvider,
  variants: ExternalVariantData[]
) {
  const results = [];
  for (const variant of variants) {
    const result = await upsertExternalVariant(teamId, accountId, provider, variant);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Update uploaded file ID for ingested image
 */
export async function updateExternalVariantUploadedFile(
  teamId: number,
  id: number,
  uploadedFileId: number
) {
  const now = new Date();

  const [row] = await db
    .update(externalVariants)
    .set({
      uploadedFileId,
      updatedAt: now,
    })
    .where(and(eq(externalVariants.teamId, teamId), eq(externalVariants.id, id)))
    .returning();

  return row ?? null;
}

/**
 * Get variants pending image ingestion
 */
export async function getVariantsPendingImageIngestion(
  teamId: number,
  accountId: number,
  limit: number = 20
) {
  return await db
    .select()
    .from(externalVariants)
    .where(
      and(
        eq(externalVariants.teamId, teamId),
        eq(externalVariants.accountId, accountId),
        sql`${externalVariants.featuredImageUrl} IS NOT NULL`,
        sql`${externalVariants.uploadedFileId} IS NULL`
      )
    )
    .limit(limit);
}

/**
 * Delete external variant
 */
export async function deleteExternalVariant(teamId: number, id: number) {
  const [row] = await db
    .delete(externalVariants)
    .where(and(eq(externalVariants.teamId, teamId), eq(externalVariants.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Count external variants for an account
 */
export async function countExternalVariants(
  teamId: number,
  accountId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(externalVariants)
    .where(
      and(
        eq(externalVariants.teamId, teamId),
        eq(externalVariants.accountId, accountId)
      )
    );
  return result[0]?.count ?? 0;
}

