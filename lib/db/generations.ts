import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { products, productVariants, setItems, sets, variantGenerations, variantImages } from './schema';

export async function listVariantGenerations(teamId: number, variantId: number) {
  return await db
    .select()
    .from(variantGenerations)
    .where(and(eq(variantGenerations.teamId, teamId), eq(variantGenerations.variantId, variantId)))
    .orderBy(desc(variantGenerations.createdAt));
}

export async function getVariantGenerationById(teamId: number, generationId: number) {
  const gen = await db.query.variantGenerations.findFirst({
    where: and(eq(variantGenerations.teamId, teamId), eq(variantGenerations.id, generationId)),
    with: { images: true },
  });
  return gen ?? null;
}

export type CreateVariantGenerationInput = {
  teamId: number;
  productId: number;
  variantId: number;
  schemaKey: string;
  input: any;
  numberOfVariations: number;
  prompt?: string | null;
};

/**
 * MVP helper: creates a generation record and N output images (mock URLs),
 * then adds images to the variant's default folder.
 */
export async function createVariantGenerationWithMockOutputs(input: CreateVariantGenerationInput) {
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Validate variant belongs to product/team and isn't deleted.
    const variant = await tx.query.productVariants.findFirst({
      where: and(
        eq(productVariants.teamId, input.teamId),
        eq(productVariants.productId, input.productId),
        eq(productVariants.id, input.variantId),
        isNull(productVariants.deletedAt)
      ),
      columns: { id: true },
    });
    if (!variant) throw new Error('Variant not found');

    // Ensure product exists and belongs to team (basic guard).
    const product = await tx.query.products.findFirst({
      where: and(
        eq(products.teamId, input.teamId),
        eq(products.id, input.productId),
        isNull(products.deletedAt)
      ),
      columns: { id: true },
    });
    if (!product) throw new Error('Product not found');

    const [gen] = await tx
      .insert(variantGenerations)
      .values({
        teamId: input.teamId,
        variantId: input.variantId,
        schemaKey: input.schemaKey,
        input: input.input ?? null,
        numberOfVariations: input.numberOfVariations,
        provider: 'mock',
        status: 'generating',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!gen) throw new Error('Failed to create generation');

    const imagesToCreate = Array.from({ length: input.numberOfVariations }).map((_, idx) => {
      const seed = gen.id * 100 + (idx + 1);
      const label = encodeURIComponent(`Gen ${idx + 1}`);
      const url = `https://placehold.co/640x640/png?text=${label}&seed=${seed}`;
      return {
        teamId: input.teamId,
        variantId: input.variantId,
        generationId: gen.id,
        status: 'ready',
        url,
        prompt: input.prompt ?? null,
        schemaKey: input.schemaKey,
        input: input.input ?? null,
      };
    });

    const createdImages = await tx.insert(variantImages).values(imagesToCreate).returning();

    // Backfill default folder (uses non-tx db helper; do it inline here to stay in tx).
    const defaultFolder = await tx.query.sets.findFirst({
      where: and(
        eq(sets.teamId, input.teamId),
        eq(sets.variantId, input.variantId),
        eq(sets.isDefault, true),
        isNull(sets.deletedAt)
      ),
    });

    const folder =
      defaultFolder ??
      (await tx
        .insert(sets)
        .values({
          teamId: input.teamId,
          scopeType: 'variant',
          productId: input.productId,
          variantId: input.variantId,
          isDefault: true,
          name: 'Default',
          description: 'All generations (auto-created)',
          createdByUserId: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0] ?? null));

    if (!folder) throw new Error('Failed to ensure default folder');

    if (createdImages.length > 0) {
      await tx.insert(setItems).values(
        createdImages.map((img, idx) => ({
          teamId: input.teamId,
          setId: folder.id,
          itemType: 'variant_image',
          itemId: img.id,
          sortOrder: idx,
          addedByUserId: null,
          createdAt: now,
        }))
      );
    }

    // Mark generation ready (since mock images are ready immediately).
    const [updatedGen] = await tx
      .update(variantGenerations)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, gen.id)))
      .returning();

    return { generation: updatedGen ?? gen, images: createdImages, folderId: folder.id };
  });
}


