import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './drizzle';
import {
  productDescriptions,
  productLinks,
  productOptions,
  productVariants,
  products,
  sets,
  variantLinks,
  variantOptionValues,
} from './schema';
import { generateText } from 'ai';

export type CreateProductInput = {
  teamId: number;
  title: string;
  category: string;
  vendor?: string | null;
  productType?: string | null;
  handle?: string | null;
  tags?: string | null;
  imageUrl?: string | null;
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
        imageUrl: input.imageUrl ?? null,
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
    .select({
      product: products,
      variantsCount: sql<number>`count(${productVariants.id})`,
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.teamId, teamId),
        eq(productVariants.productId, products.id),
        isNull(productVariants.deletedAt)
      )
    )
    .where(and(eq(products.teamId, teamId), isNull(products.deletedAt)))
    .groupBy(products.id)
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
  imageUrl?: string | null;
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
    // Get all variants for this product before deleting
    const variants = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.teamId, teamId),
          eq(productVariants.productId, productId),
          isNull(productVariants.deletedAt)
        )
      );

    // Delete all variant links for each variant (within transaction)
    for (const variant of variants) {
      await tx
        .delete(variantLinks)
        .where(
          and(
            eq(variantLinks.teamId, teamId),
            eq(variantLinks.variantId, variant.id)
          )
        );
    }

    // Delete all product links (within transaction)
    await tx
      .delete(productLinks)
      .where(
        and(
          eq(productLinks.teamId, teamId),
          eq(productLinks.productId, productId)
        )
      );

    // Soft delete variants
    await tx
      .update(productVariants)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(productVariants.teamId, teamId), eq(productVariants.productId, productId)));

    // Soft delete product
    await tx
      .update(products)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(products.teamId, teamId), eq(products.id, productId)));
  });
}

export type CreateVariantInput = {
  teamId: number;
  productId: number;
  title: string;
  sku?: string | null;
  imageUrl?: string | null;
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
        imageUrl: input.imageUrl ?? null,
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
  return await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.teamId, teamId),
      eq(productVariants.productId, productId),
      isNull(productVariants.deletedAt)
    ),
    with: { optionValues: true },
    orderBy: desc(productVariants.updatedAt),
  });
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
  imageUrl?: string | null;
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

  // Delete all variant links before soft deleting
  await db
    .delete(variantLinks)
    .where(
      and(
        eq(variantLinks.teamId, teamId),
        eq(variantLinks.variantId, variantId)
      )
    );

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

// ============================================================================
// Product Descriptions
// ============================================================================

export type CreateProductDescriptionInput = {
  teamId: number;
  productId: number;
  prompt: string;
  tone?: 'premium' | 'playful' | 'minimal' | null;
  length?: 'short' | 'medium' | 'long' | null;
  productTitle: string;
  productCategory: string;
  productImageUrl?: string | null;
};

export async function listProductDescriptions(teamId: number, productId: number) {
  return await db.query.productDescriptions.findMany({
    where: and(
      eq(productDescriptions.teamId, teamId),
      eq(productDescriptions.productId, productId)
    ),
    orderBy: desc(productDescriptions.createdAt),
  });
}

export async function getProductDescriptionById(
  teamId: number,
  productId: number,
  descriptionId: number
) {
  const result = await db.query.productDescriptions.findFirst({
    where: and(
      eq(productDescriptions.teamId, teamId),
      eq(productDescriptions.productId, productId),
      eq(productDescriptions.id, descriptionId)
    ),
  });
  return result ?? null;
}

export async function createProductDescription(input: CreateProductDescriptionInput) {
  // 1. Create "generating" record
  const [record] = await db
    .insert(productDescriptions)
    .values({
      teamId: input.teamId,
      productId: input.productId,
      status: 'generating',
      prompt: input.prompt,
      tone: input.tone ?? null,
      length: input.length ?? null,
      content: null,
      errorMessage: null,
    })
    .returning();

  if (!record) {
    throw new Error('Failed to create product description record');
  }

  // 2. Build the AI prompt
  const toneInstruction = input.tone
    ? `Use a ${input.tone} tone.`
    : '';
  const lengthInstruction = input.length === 'short'
    ? 'Keep it concise, around 50 words.'
    : input.length === 'long'
      ? 'Write a detailed description, around 150-200 words.'
      : 'Write a medium-length description, around 80-100 words.';

  const textPrompt = `You are an expert e-commerce copywriter. Generate a compelling product description for an online store.

Product: ${input.productTitle}
Category: ${input.productCategory}

${toneInstruction}
${lengthInstruction}

User instructions: ${input.prompt}

${input.productImageUrl ? 'I have attached the product image for reference. Use the visual details from the image to create a more accurate and compelling description.' : ''}

Write only the description text. Do not include any headers, labels, or markdown formatting. Make it engaging and suitable for an e-commerce product page.`;

  try {
    // 3. Call Gemini via Vercel AI SDK (multimodal if image available)
    let result: any;
    
    if (input.productImageUrl) {
      // Fetch image as bytes for multimodal generation
      let imageData: { bytes: Uint8Array; mimeType: string } | null = null;
      try {
        const imageRes = await fetch(input.productImageUrl);
        if (imageRes.ok) {
          const mimeType = imageRes.headers.get('content-type') ?? 'image/png';
          const ab = await imageRes.arrayBuffer();
          imageData = { bytes: new Uint8Array(ab), mimeType };
        }
      } catch (e) {
        // If image fetch fails, continue without image
        console.warn('Failed to fetch product image for description generation:', e);
      }

      if (imageData) {
        // Multimodal: include product image + prompt
        result = await generateText({
          model: 'google/gemini-2.0-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: textPrompt },
                { type: 'image', image: imageData.bytes, mimeType: imageData.mimeType },
              ],
            },
          ],
        } as any);
      } else {
        // Fallback to text-only if image fetch failed
        result = await generateText({
          model: 'google/gemini-2.0-flash',
          prompt: textPrompt,
        } as any);
      }
    } else {
      // Text-only generation
      result = await generateText({
        model: 'google/gemini-2.0-flash',
        prompt: textPrompt,
      } as any);
    }

    const content = typeof result === 'string' 
      ? result 
      : (result as any)?.text ?? (result as any)?.content ?? '';

    // 4. Update record with generated content
    const [updated] = await db
      .update(productDescriptions)
      .set({
        status: 'ready',
        content: content.trim(),
      })
      .where(eq(productDescriptions.id, record.id))
      .returning();

    return updated ?? record;
  } catch (error: any) {
    // Update record with error
    const [failed] = await db
      .update(productDescriptions)
      .set({
        status: 'failed',
        errorMessage: error?.message ?? 'Generation failed',
      })
      .where(eq(productDescriptions.id, record.id))
      .returning();

    return failed ?? record;
  }
}

export async function updateProductDescriptionContent(
  teamId: number,
  productId: number,
  descriptionId: number,
  content: string
) {
  const [updated] = await db
    .update(productDescriptions)
    .set({ content })
    .where(
      and(
        eq(productDescriptions.teamId, teamId),
        eq(productDescriptions.productId, productId),
        eq(productDescriptions.id, descriptionId)
      )
    )
    .returning();

  return updated ?? null;
}

export async function selectProductDescription(
  teamId: number,
  productId: number,
  descriptionId: number
) {
  // Verify description exists and belongs to the product
  const desc = await db.query.productDescriptions.findFirst({
    where: and(
      eq(productDescriptions.teamId, teamId),
      eq(productDescriptions.productId, productId),
      eq(productDescriptions.id, descriptionId)
    ),
    columns: { id: true },
  });

  if (!desc) {
    return null;
  }

  const [updated] = await db
    .update(products)
    .set({
      selectedDescriptionId: descriptionId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.teamId, teamId),
        eq(products.id, productId),
        isNull(products.deletedAt)
      )
    )
    .returning();

  return updated ?? null;
}

export async function deleteProductDescription(
  teamId: number,
  productId: number,
  descriptionId: number
) {
  // Check if this is the selected description
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.teamId, teamId),
      eq(products.id, productId),
      isNull(products.deletedAt)
    ),
    columns: { id: true, selectedDescriptionId: true },
  });

  if (!product) {
    return { ok: false as const, reason: 'product_not_found' as const };
  }

  // If deleting the selected description, clear the selection
  if (product.selectedDescriptionId === descriptionId) {
    await db
      .update(products)
      .set({ selectedDescriptionId: null, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  // Delete the description
  await db
    .delete(productDescriptions)
    .where(
      and(
        eq(productDescriptions.teamId, teamId),
        eq(productDescriptions.productId, productId),
        eq(productDescriptions.id, descriptionId)
      )
    );

  return { ok: true as const };
}
