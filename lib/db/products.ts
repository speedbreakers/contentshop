import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle';
import {
  productOptions,
  productVariants,
  products,
  sets,
  variantOptionValues,
} from './schema';

export type CreateProductInput = {
  teamId: number;
  title: string;
  category: string;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  tags?: string | null;
  shopifyProductGid?: string | null;
  options?: Array<{ name: string; position: number }>;
};

export async function createProductWithDefaultVariant(input: CreateProductInput) {
  return await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        teamId: input.teamId,
        title: input.title,
        category: input.category,
        vendor: input.vendor ?? null,
        productType: input.productType ?? null,
        handle: input.handle ?? null,
        tags: input.tags ?? null,
        shopifyProductGid: input.shopifyProductGid ?? null,
      })
      .returning();

    if (!product) {
      throw new Error('Failed to create product');
    }

    const [defaultVariant] = await tx
      .insert(productVariants)
      .values({
        teamId: input.teamId,
        productId: product.id,
        title: 'Default',
      })
      .returning();

    if (!defaultVariant) {
      throw new Error('Failed to create default variant');
    }

    const [updatedProduct] = await tx
      .update(products)
      .set({
        defaultVariantId: defaultVariant.id,
        updatedAt: new Date(),
      })
      .where(eq(products.id, product.id))
      .returning();

    if (!updatedProduct) {
      throw new Error('Failed to set default variant on product');
    }

    // Ensure a backend-generated default set exists for this variant.
    await tx.insert(sets).values({
      teamId: input.teamId,
      scopeType: 'variant',
      productId: updatedProduct.id,
      variantId: defaultVariant.id,
      isDefault: true,
      name: 'Default',
      description: 'All generations (auto-created)',
      createdByUserId: null,
    });

    const optionsToCreate = (input.options ?? []).filter(
      (o) => o?.name && Number.isFinite(o.position)
    );
    if (optionsToCreate.length > 0) {
      await tx.insert(productOptions).values(
        optionsToCreate.map((o) => ({
          teamId: input.teamId,
          productId: updatedProduct.id,
          name: o.name,
          position: o.position,
        }))
      );
    }

    return { product: updatedProduct, defaultVariant };
  });
}

export async function listProducts(teamId: number) {
  return await db
    .select()
    .from(products)
    .where(and(eq(products.teamId, teamId), isNull(products.deletedAt)))
    .orderBy(desc(products.updatedAt));
}

export async function getProductById(teamId: number, productId: number) {
  const result = await db.query.products.findFirst({
    where: and(
      eq(products.teamId, teamId),
      eq(products.id, productId),
      isNull(products.deletedAt)
    ),
    with: {
      options: true,
      variants: {
        where: isNull(productVariants.deletedAt),
        with: {
          optionValues: true,
        },
      },
    },
  });

  return result ?? null;
}

export type UpdateProductInput = {
  title?: string;
  category?: string;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  tags?: string | null;
  status?: string;
  shopifyProductGid?: string | null;
};

export async function updateProduct(
  teamId: number,
  productId: number,
  patch: UpdateProductInput
) {
  const [updated] = await db
    .update(products)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.teamId, teamId), eq(products.id, productId), isNull(products.deletedAt))
    )
    .returning();

  return updated ?? null;
}

export async function softDeleteProduct(teamId: number, productId: number) {
  const now = new Date();
  return await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(products.teamId, teamId), eq(products.id, productId)));

    await tx
      .update(productVariants)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(productVariants.teamId, teamId), eq(productVariants.productId, productId)));
  });
}

export type CreateVariantInput = {
  teamId: number;
  productId: number;
  title: string;
  sku?: string | null;
  shopifyVariantGid?: string | null;
  optionValues?: Array<{ productOptionId: number; value: string }>;
};

export async function createVariant(input: CreateVariantInput) {
  return await db.transaction(async (tx) => {
    const [variant] = await tx
      .insert(productVariants)
      .values({
        teamId: input.teamId,
        productId: input.productId,
        title: input.title,
        sku: input.sku ?? null,
        shopifyVariantGid: input.shopifyVariantGid ?? null,
      })
      .returning();

    if (!variant) {
      throw new Error('Failed to create variant');
    }

    // Ensure a backend-generated default set exists for this new variant.
    await tx.insert(sets).values({
      teamId: input.teamId,
      scopeType: 'variant',
      productId: input.productId,
      variantId: variant.id,
      isDefault: true,
      name: 'Default',
      description: 'All generations (auto-created)',
      createdByUserId: null,
    });

    const values = (input.optionValues ?? []).filter(
      (v) => Number.isFinite(v.productOptionId) && typeof v.value === 'string'
    );

    if (values.length > 0) {
      // Ensure product options belong to the same product via join validation.
      const validOptionIds = await tx
        .select({ id: productOptions.id })
        .from(productOptions)
        .where(
          and(
            eq(productOptions.teamId, input.teamId),
            eq(productOptions.productId, input.productId)
          )
        );
      const allowed = new Set(validOptionIds.map((r) => r.id));

      const filtered = values.filter((v) => allowed.has(v.productOptionId));
      if (filtered.length !== values.length) {
        throw new Error('One or more optionValues refer to invalid productOptionId');
      }

      await tx.insert(variantOptionValues).values(
        filtered.map((v) => ({
          variantId: variant.id,
          productOptionId: v.productOptionId,
          value: v.value,
        }))
      );
    }

    return variant;
  });
}

export async function listVariants(teamId: number, productId: number) {
  return await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.teamId, teamId),
        eq(productVariants.productId, productId),
        isNull(productVariants.deletedAt)
      )
    )
    .orderBy(desc(productVariants.updatedAt));
}

export async function getVariantById(
  teamId: number,
  productId: number,
  variantId: number
) {
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, teamId),
      eq(productVariants.productId, productId),
      eq(productVariants.id, variantId),
      isNull(productVariants.deletedAt)
    ),
    with: { optionValues: true },
  });

  return variant ?? null;
}

export type UpdateVariantInput = {
  title?: string;
  sku?: string | null;
  shopifyVariantGid?: string | null;
  optionValues?: Array<{ productOptionId: number; value: string }>;
};

export async function updateVariant(
  teamId: number,
  productId: number,
  variantId: number,
  patch: UpdateVariantInput
) {
  return await db.transaction(async (tx) => {
    const { optionValues, ...variantPatch } = patch;

    const [updatedVariant] = await tx
      .update(productVariants)
      .set({
        ...variantPatch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productVariants.teamId, teamId),
          eq(productVariants.productId, productId),
          eq(productVariants.id, variantId)
        )
      )
      .returning();

    if (!updatedVariant) {
      return null;
    }

    if (optionValues) {
      await tx
        .delete(variantOptionValues)
        .where(eq(variantOptionValues.variantId, variantId));

      if (optionValues.length > 0) {
        const validOptionIds = await tx
          .select({ id: productOptions.id })
          .from(productOptions)
          .where(
            and(
              eq(productOptions.teamId, teamId),
              eq(productOptions.productId, productId)
            )
          );
        const allowed = new Set(validOptionIds.map((r) => r.id));

        const filtered = optionValues.filter((v) => allowed.has(v.productOptionId));
        if (filtered.length !== optionValues.length) {
          throw new Error('One or more optionValues refer to invalid productOptionId');
        }

        await tx.insert(variantOptionValues).values(
          filtered.map((v) => ({
            variantId,
            productOptionId: v.productOptionId,
            value: v.value,
          }))
        );
      }
    }

    return updatedVariant;
  });
}

export async function setDefaultVariant(
  teamId: number,
  productId: number,
  variantId: number
) {
  // Ensure variant belongs to product and is not deleted.
  const v = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, teamId),
      eq(productVariants.productId, productId),
      eq(productVariants.id, variantId),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true },
  });
  if (!v) {
    return null;
  }

  const [updated] = await db
    .update(products)
    .set({ defaultVariantId: variantId, updatedAt: new Date() })
    .where(and(eq(products.teamId, teamId), eq(products.id, productId)))
    .returning();

  return updated ?? null;
}

export async function softDeleteVariant(
  teamId: number,
  productId: number,
  variantId: number
) {
  const now = new Date();

  const product = await db.query.products.findFirst({
    where: and(eq(products.teamId, teamId), eq(products.id, productId)),
    columns: { id: true, defaultVariantId: true },
  });
  if (!product) {
    return { ok: false as const, reason: 'not_found' as const };
  }

  if (product.defaultVariantId === variantId) {
    // Disallow deleting default variant directly. Caller must reassign first.
    return { ok: false as const, reason: 'is_default' as const };
  }

  // If this is the last active variant, disallow deletion.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.teamId, teamId),
        eq(productVariants.productId, productId),
        isNull(productVariants.deletedAt)
      )
    );

  if ((count ?? 0) <= 1) {
    return { ok: false as const, reason: 'last_variant' as const };
  }

  await db
    .update(productVariants)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(productVariants.teamId, teamId),
        eq(productVariants.productId, productId),
        eq(productVariants.id, variantId)
      )
    );

  return { ok: true as const };
}


