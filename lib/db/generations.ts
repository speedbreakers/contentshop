import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { products, productVariants, setItems, sets, variantGenerations, variantImages, type GenerationJob, type VariantImage } from './schema';
import { put } from '@vercel/blob';
import { generateText } from 'ai';
import {
  buildSameOriginAuthHeaders,
  coerceResultFileToBytes,
  fetchAsBytes,
  resolveUrl,
} from '@/lib/ai/shared/image-fetch';
import {
  getGenerationJobById,
  markGenerationJobRunning,
  markGenerationJobSuccess,
  markGenerationJobFailed,
  updateGenerationJobProgress,
  updateGenerationJobMetadata,
  type GenerationJobMetadata,
  type GenerationJobProgress,
} from './generation-jobs';
import JSZip from 'jszip';

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

export async function getVariantImageById(teamId: number, imageId: number) {
  const row = await db.query.variantImages.findFirst({
    where: and(eq(variantImages.teamId, teamId), eq(variantImages.id, imageId)),
  });
  return row ?? null;
}

export async function listVariantImagesByIds(teamId: number, imageIds: number[]) {
  const ids = Array.from(new Set(imageIds.filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return [];
  return await db.query.variantImages.findMany({
    where: and(eq(variantImages.teamId, teamId), inArray(variantImages.id, ids)),
  });
}

export type CreateVariantGenerationInput = {
  teamId: number;
  productId: number;
  variantId: number;
  schemaKey: string;
  input: any;
  numberOfVariations: number;
  prompts: string[]; // Required for per-variation prompts
  moodboardId?: number | null;
};

export type CreateVariantGenerationGeminiInput = CreateVariantGenerationInput & {
  requestOrigin: string;
  authCookie?: string | null;
  productTitle: string;
  productCategory: string;
  extraReferenceImageUrls?: string[];
  /** Optional: add outputs into this folder instead of default (must belong to this team+variant). */
  targetSetId?: number | null;
  /** Optional: also add outputs into this folder (e.g. shared batch folder). */
  alsoAddToSetId?: number | null;
  /** Optional callback to update progress after each image (for queue-based processing) */
  onProgress?: (current: number, total: number, imageId: number) => Promise<void>;
};

export type ProvidedOutput = {
  blobUrl: string;
  prompt?: string;
  mimeType?: string;
};

/**
 * Persists a generation and already-created image outputs (e.g. pipeline workflows),
 * then adds images to the variant's default folder.
 */
export async function createVariantGenerationWithProvidedOutputs(
  input: CreateVariantGenerationInput & { outputs: ProvidedOutput[]; generationId?: number }
) {
  const now = new Date();

  // Validate variant/product belong to team and aren't deleted.
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, input.teamId),
      eq(productVariants.productId, input.productId),
      eq(productVariants.id, input.variantId),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true },
  });
  if (!variant) throw new Error('Variant not found');

  const product = await db.query.products.findFirst({
    where: and(eq(products.teamId, input.teamId), eq(products.id, input.productId), isNull(products.deletedAt)),
    columns: { id: true },
  });
  if (!product) throw new Error('Product not found');

  const gen =
    typeof input.generationId === 'number'
      ? await db.query.variantGenerations.findFirst({
        where: and(
          eq(variantGenerations.teamId, input.teamId),
          eq(variantGenerations.id, input.generationId)
        ),
      })
      : null;

  const createdGen =
    gen ??
    (await db
      .insert(variantGenerations)
      .values({
        teamId: input.teamId,
        variantId: input.variantId,
        schemaKey: input.schemaKey,
        input: input.input ?? null,
        numberOfVariations: input.numberOfVariations,
        moodboardId: input.moodboardId ?? null,
        provider: 'gemini',
        status: 'generating',
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .then((rows) => rows[0] ?? null));

  if (!createdGen) throw new Error('Failed to create generation');

  try {
    // Ensure default folder exists.
    const defaultFolder = await db.query.sets.findFirst({
      where: and(
        eq(sets.teamId, input.teamId),
        eq(sets.variantId, input.variantId),
        eq(sets.isDefault, true),
        isNull(sets.deletedAt)
      ),
    });

    const folder =
      defaultFolder ??
      (await db
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

    // Update generation input/schemaKey to the final values (pipeline may enrich input).
    await db
      .update(variantGenerations)
      .set({
        schemaKey: input.schemaKey,
        input: input.input ?? null,
        moodboardId: input.moodboardId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, createdGen.id)));

    const createdImages = await db
      .insert(variantImages)
      .values(
        (input.outputs ?? []).map((o) => ({
          teamId: input.teamId,
          variantId: input.variantId,
          generationId: createdGen.id,
          status: 'ready',
          url: o.blobUrl,
          prompt: o.prompt ?? null,
          schemaKey: input.schemaKey,
          input: input.input ?? null,
          createdAt: new Date(),
        }))
      )
      .returning();

    if (createdImages.length > 0) {
      await db.insert(setItems).values(
        createdImages.map((img, idx) => ({
          teamId: input.teamId,
          setId: folder.id,
          itemType: 'variant_image',
          itemId: img.id,
          sortOrder: idx,
          addedByUserId: null,
          createdAt: new Date(),
        }))
      );
    }

    const [updatedGen] = await db
      .update(variantGenerations)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, createdGen.id)))
      .returning();

    return { generation: updatedGen ?? createdGen, images: createdImages, folderId: folder.id };
  } catch (err: any) {
    const message = err?.message ? String(err.message).slice(0, 500) : 'Generation failed';
    await db
      .update(variantGenerations)
      .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, createdGen.id)));
    throw err;
  }
}

export type CreateVariantEditGeminiInput = {
  teamId: number;
  productId: number;
  variantId: number;
  schemaKey: string; // edit.v1
  targetSetId?: number | null;
  input: {
    base_image_url: string;
    reference_image_url?: string | null;
    edit_instructions?: string;
    base_label?: string;
    output_label?: string;
  };
  prompt?: string | null;
  requestOrigin: string;
  authCookie?: string | null;
  productTitle: string;
  productCategory: string;
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
        prompt: input.prompts[idx] ?? null,
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

/**
 * Hero generation: calls Gemini image generation via Vercel AI SDK (AI Gateway),
 * uploads outputs to Vercel Blob, persists variant_images, and adds them to the default folder.
 */
export async function createVariantGenerationWithGeminiOutputs(input: CreateVariantGenerationGeminiInput) {
  const now = new Date();

  // Validate variant/product belong to team and aren't deleted.
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, input.teamId),
      eq(productVariants.productId, input.productId),
      eq(productVariants.id, input.variantId),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true },
  });
  if (!variant) throw new Error('Variant not found');

  const product = await db.query.products.findFirst({
    where: and(eq(products.teamId, input.teamId), eq(products.id, input.productId), isNull(products.deletedAt)),
    columns: { id: true },
  });
  if (!product) throw new Error('Product not found');

  const [gen] = await db
    .insert(variantGenerations)
    .values({
      teamId: input.teamId,
      variantId: input.variantId,
      schemaKey: input.schemaKey,
      input: input.input ?? null,
      numberOfVariations: input.numberOfVariations,
      moodboardId: input.moodboardId ?? null,
      provider: 'gemini',
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!gen) throw new Error('Failed to create generation');

  try {
    // Choose target folder:
    // - Prefer provided targetSetId (must belong to this team+variant and not deleted)
    // - Else fallback to default folder (ensure it exists)
    const targetFolder =
      input.targetSetId
        ? await db.query.sets.findFirst({
          where: and(
            eq(sets.teamId, input.teamId),
            eq(sets.variantId, input.variantId),
            eq(sets.id, input.targetSetId),
            isNull(sets.deletedAt)
          ),
        })
        : null;

    // Ensure default folder exists.
    const defaultFolder = await db.query.sets.findFirst({
      where: and(
        eq(sets.teamId, input.teamId),
        eq(sets.variantId, input.variantId),
        eq(sets.isDefault, true),
        isNull(sets.deletedAt)
      ),
    });

    const ensuredDefault =
      defaultFolder ??
      (await db
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

    const folder = targetFolder ?? ensuredDefault;
    if (!folder) throw new Error('Failed to ensure default folder');

    const alsoFolder =
      input.alsoAddToSetId && input.alsoAddToSetId !== folder.id
        ? await db.query.sets.findFirst({
          where: and(
            eq(sets.teamId, input.teamId),
            eq(sets.id, input.alsoAddToSetId),
            isNull(sets.deletedAt)
          ),
        })
        : null;

    const productImages: string[] = Array.isArray((input.input as any)?.product_images)
      ? (input.input as any).product_images
      : [];
    if (productImages.length === 0) throw new Error('product_images is required');

    const extra = Array.isArray(input.extraReferenceImageUrls) ? input.extraReferenceImageUrls : [];
    const resolved = [
      ...productImages.map((u) => resolveUrl(input.requestOrigin, String(u))),
      ...extra.map((u) => resolveUrl(input.requestOrigin, String(u))),
    ];
    const referenceImages = await Promise.all(
      resolved.map((url) => {
        const headers = buildSameOriginAuthHeaders({
          requestOrigin: input.requestOrigin,
          url,
          cookie: input.authCookie,
        });
        return fetchAsBytes(url, headers ? { headers } : undefined);
      })
    );

    const createdImages: Array<typeof variantImages.$inferSelect> = [];

    // Process images one at a time for incremental progress updates
    for (let idx = 0; idx < input.numberOfVariations; idx++) {
      const prompt = input.prompts[idx]?.trim() || '';

      // Ensure we have a valid prompt
      if (!prompt || prompt.trim().length === 0) {
        throw new Error(`Invalid prompt for variation ${idx + 1}: prompt is empty`);
      }

      // Multimodal: include reference images + prompt.
      const result: any = await generateText({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...referenceImages.map((ri) => ({
                type: 'image',
                image: ri.bytes,
                mimeType: ri.mimeType,
              })),
            ],
          },
        ],
      } as any);

      if (result.content?.[0]?.text && !result?.files?.length) {
        throw new Error(`Gemini returned content: ${result.content[0].text}`);
      }

      const files: any[] = Array.isArray(result?.files) ? result.files : [];
      const firstImage = files.find((f) => String(f?.mediaType ?? f?.mimeType ?? '').startsWith('image/')) ?? files[0];
      if (!firstImage) throw new Error('Gemini returned no files');

      const { bytes, mimeType } = coerceResultFileToBytes(firstImage);
      const ext =
        mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'png';

      const pathname = `team-${input.teamId}/variant-${input.variantId}/generations/${gen.id}/${idx + 1}.${ext}`;
      const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
      const putRes = await put(pathname, blob, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      } as any);

      // Create image record immediately (not batched)
      const [createdImage] = await db
        .insert(variantImages)
        .values({
          teamId: input.teamId,
          variantId: input.variantId,
          generationId: gen.id,
          status: 'ready',
          url: putRes.url,
          prompt: prompt,
          schemaKey: input.schemaKey,
          input: input.input ?? null,
          createdAt: new Date(),
        })
        .returning();

      if (createdImage) {
        createdImages.push(createdImage);

        // Add to folder immediately
        await db.insert(setItems).values({
          teamId: input.teamId,
          setId: folder.id,
          itemType: 'variant_image',
          itemId: createdImage.id,
          sortOrder: idx,
          addedByUserId: null,
          createdAt: new Date(),
        });

        // Optionally also add to a secondary folder (e.g. shared batch folder)
        if (alsoFolder && alsoFolder.id !== folder.id) {
          try {
            await db.insert(setItems).values({
              teamId: input.teamId,
              setId: alsoFolder.id,
              itemType: 'variant_image',
              itemId: createdImage.id,
              sortOrder: idx,
              addedByUserId: null,
              createdAt: new Date(),
            });
          } catch (e) {
            // Ignore duplicate insert attempts (unique index on setId+itemType+itemId)
          }
        }

        // Call progress callback if provided (for queue-based processing)
        if (input.onProgress) {
          await input.onProgress(idx + 1, input.numberOfVariations, createdImage.id);
        }
      }
    }

    const [updatedGen] = await db
      .update(variantGenerations)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, gen.id)))
      .returning();

    return { generation: updatedGen ?? gen, images: createdImages, folderId: folder.id };
  } catch (err: any) {
    const message = err?.message ? String(err.message).slice(0, 500) : 'Generation failed';
    await db
      .update(variantGenerations)
      .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, gen.id)));
    throw err;
  }
}

/**
 * Edit flow: base image + optional reference image + instructions -> 1 output.
 */
export async function createVariantEditWithGeminiOutput(input: CreateVariantEditGeminiInput) {
  const now = new Date();

  // Validate variant/product belong to team and aren't deleted.
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, input.teamId),
      eq(productVariants.productId, input.productId),
      eq(productVariants.id, input.variantId),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true },
  });
  if (!variant) throw new Error('Variant not found');

  const product = await db.query.products.findFirst({
    where: and(eq(products.teamId, input.teamId), eq(products.id, input.productId), isNull(products.deletedAt)),
    columns: { id: true },
  });
  if (!product) throw new Error('Product not found');

  const [gen] = await db
    .insert(variantGenerations)
    .values({
      teamId: input.teamId,
      variantId: input.variantId,
      schemaKey: input.schemaKey,
      input: input.input ?? null,
      numberOfVariations: 1,
      provider: 'gemini',
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!gen) throw new Error('Failed to create generation');

  try {
    // Choose target folder:
    // - Prefer provided targetSetId (must belong to this team+variant and not deleted)
    // - Else fallback to default folder (ensure it exists)
    const targetFolder =
      input.targetSetId
        ? await db.query.sets.findFirst({
          where: and(
            eq(sets.teamId, input.teamId),
            eq(sets.variantId, input.variantId),
            eq(sets.id, input.targetSetId),
            isNull(sets.deletedAt)
          ),
        })
        : null;

    const defaultFolder = await db.query.sets.findFirst({
      where: and(
        eq(sets.teamId, input.teamId),
        eq(sets.variantId, input.variantId),
        eq(sets.isDefault, true),
        isNull(sets.deletedAt)
      ),
    });

    const ensuredDefault =
      defaultFolder ??
      (await db
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

    const folder = targetFolder ?? ensuredDefault;

    if (!folder) throw new Error('Failed to ensure default folder');

    const baseUrl = resolveUrl(input.requestOrigin, String(input.input.base_image_url));
    const baseHeaders = buildSameOriginAuthHeaders({
      requestOrigin: input.requestOrigin,
      url: baseUrl,
      cookie: input.authCookie,
    });
    const base = await fetchAsBytes(baseUrl, baseHeaders ? { headers: baseHeaders } : undefined);

    const refUrlRaw = input.input.reference_image_url?.trim?.() ? String(input.input.reference_image_url) : '';
    const refUrl = refUrlRaw ? resolveUrl(input.requestOrigin, refUrlRaw) : '';
    const refHeaders = refUrl
      ? buildSameOriginAuthHeaders({
        requestOrigin: input.requestOrigin,
        url: refUrl,
        cookie: input.authCookie,
      })
      : undefined;
    const ref = refUrl ? await fetchAsBytes(refUrl, refHeaders ? { headers: refHeaders } : undefined) : null;

    const instructions = (input.input.edit_instructions ?? input.prompt ?? '').trim();
    const prompt =
      `You are editing a product image for \"${input.productTitle}\" (Category: ${input.productCategory}). ` +
      `Make the requested edits to the base image.` +
      (ref ? ' Use the second image as a reference for style/composition.' : '') +
      (instructions ? ` Instructions: ${instructions}` : '');

    const result: any = await generateText({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: base.bytes, mimeType: base.mimeType },
            ...(ref ? [{ type: 'image', image: ref.bytes, mimeType: ref.mimeType }] : []),
          ],
        },
      ],
    } as any);

    const files: any[] = Array.isArray(result?.files) ? result.files : [];
    const firstImage = files.find((f) => String(f?.mediaType ?? f?.mimeType ?? '').startsWith('image/')) ?? files[0];
    if (!firstImage) throw new Error('Gemini returned no files');

    const { bytes, mimeType } = coerceResultFileToBytes(firstImage);
    const ext =
      mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'png';

    const pathname = `team-${input.teamId}/variant-${input.variantId}/edits/${gen.id}/1.${ext}`;
    const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
    const putRes = await put(pathname, blob, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    } as any);

    const [createdImage] = await db
      .insert(variantImages)
      .values({
        teamId: input.teamId,
        variantId: input.variantId,
        generationId: gen.id,
        status: 'ready',
        url: putRes.url,
        prompt: instructions || null,
        schemaKey: input.schemaKey,
        input: input.input ?? null,
        createdAt: new Date(),
      })
      .returning();

    if (!createdImage) throw new Error('Failed to create variant image');

    await db.insert(setItems).values({
      teamId: input.teamId,
      setId: folder.id,
      itemType: 'variant_image',
      itemId: createdImage.id,
      sortOrder: 0,
      addedByUserId: null,
      createdAt: new Date(),
    });

    const [updatedGen] = await db
      .update(variantGenerations)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, gen.id)))
      .returning();

    return { generation: updatedGen ?? gen, image: createdImage, folderId: folder.id };
  } catch (err: any) {
    const message = err?.message ? String(err.message).slice(0, 500) : 'Edit failed';
    await db
      .update(variantGenerations)
      .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
      .where(and(eq(variantGenerations.teamId, input.teamId), eq(variantGenerations.id, gen.id)));
    throw err;
  }
}

/**
 * Process a queued generation job.
 * Called by the cron worker to process jobs in the background.
 */
export async function processGenerationJob(
  job: GenerationJob
): Promise<{ success: boolean; error?: string }> {
  const { id: jobId, teamId, productId, variantId, metadata } = job;
  const meta = metadata as GenerationJobMetadata | null;

  if (!meta) {
    await markGenerationJobFailed(teamId, jobId, 'Missing job metadata');
    return { success: false, error: 'Missing job metadata' };
  }

  // Mark job as running
  await markGenerationJobRunning(teamId, jobId);

  // Initialize progress
  const numberOfVariations = meta.numberOfVariations ?? 1;
  const completedImageIds: number[] = [];

  try {
    // Get product info for prompt generation
    const product = await db.query.products.findFirst({
      where: and(eq(products.teamId, teamId), eq(products.id, productId), isNull(products.deletedAt)),
      columns: { id: true, title: true, category: true },
    });
    if (!product) throw new Error('Product not found');

    // Progress callback to update job status after each image
    const onProgress = async (current: number, total: number, imageId: number) => {
      completedImageIds.push(imageId);
      await updateGenerationJobProgress(teamId, jobId, {
        current,
        total,
        completedImageIds: [...completedImageIds],
      });
    };

    // Call the generation function with progress callback
    const result = await createVariantGenerationWithGeminiOutputs({
      teamId,
      productId,
      variantId,
      schemaKey: meta.schemaKey ?? 'generated.v1',
      input: meta.input ?? {},
      numberOfVariations,
      prompts: meta.prompts ?? [], // Required prompts array for per-variation instructions
      moodboardId: meta.moodboardId ?? null,
      requestOrigin: meta.requestOrigin ?? '',
      authCookie: meta.authCookie ?? null,
      productTitle: meta.productTitle ?? product.title,
      productCategory: meta.productCategory ?? product.category,
      extraReferenceImageUrls: meta.extraReferenceImageUrls ?? [],
      targetSetId: (meta as any)?.targetSetId ? Number((meta as any).targetSetId) : null,
      alsoAddToSetId: (meta as any)?.sharedSetId ? Number((meta as any).sharedSetId) : null,
      onProgress,
    });

    // Mark job as success
    await markGenerationJobSuccess(teamId, jobId, result.generation.id, {
      current: numberOfVariations,
      total: numberOfVariations,
      completedImageIds,
    });

    // Generate zip file for batches with multiple images
    if (numberOfVariations > 1 && result.images.length > 1) {
      try {
        const zipUrl = await generateBatchZip(result.images, jobId, teamId);
        // Update job metadata with zip URL
        const updatedMeta = { ...(meta ?? {}), zipUrl };
        await updateGenerationJobMetadata(teamId, jobId, updatedMeta);
      } catch (zipErr: any) {
        // Log error but don't fail the job - images are already saved
        console.error(`[Generation Job ${jobId}] Failed to generate zip:`, zipErr?.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    const errorMessage = err?.message ? String(err.message).slice(0, 500) : 'Generation failed';
    await markGenerationJobFailed(teamId, jobId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get images for a generation job (for polling API)
 */
export async function getImagesForGenerationJob(teamId: number, jobId: number) {
  const job = await getGenerationJobById(teamId, jobId);
  if (!job) return [];

  // If job has a generationId, get images from that generation
  if (job.generationId) {
    return await db.query.variantImages.findMany({
      where: and(
        eq(variantImages.teamId, teamId),
        eq(variantImages.generationId, job.generationId)
      ),
      orderBy: desc(variantImages.createdAt),
    });
  }

  // Otherwise, try to get images from progress
  const progress = job.progress as GenerationJobProgress | null;
  if (progress?.completedImageIds?.length) {
    return await listVariantImagesByIds(teamId, progress.completedImageIds);
  }

  return [];
}

/**
 * Process a queued edit job.
 * Called by the cron worker to process edit jobs in the background.
 */
export async function processEditJob(
  job: GenerationJob
): Promise<{ success: boolean; error?: string }> {
  const { id: jobId, teamId, productId, variantId, metadata } = job;
  const meta = metadata as GenerationJobMetadata | null;

  if (!meta) {
    await markGenerationJobFailed(teamId, jobId, 'Missing job metadata');
    return { success: false, error: 'Missing job metadata' };
  }

  // Mark job as running
  await markGenerationJobRunning(teamId, jobId);

  try {
    // Get product info
    const product = await db.query.products.findFirst({
      where: and(eq(products.teamId, teamId), eq(products.id, productId), isNull(products.deletedAt)),
      columns: { id: true, title: true, category: true },
    });
    if (!product) throw new Error('Product not found');

    const input = (meta.input ?? {}) as Record<string, unknown>;

    // Call the edit function
    const result = await createVariantEditWithGeminiOutput({
      teamId,
      productId,
      variantId,
      schemaKey: meta.schemaKey ?? 'edit.v1',
      targetSetId: (meta as any).targetSetId ?? undefined,
      input: {
        base_image_url: String(input.base_image_url ?? ''),
        reference_image_url: input.reference_image_url ? String(input.reference_image_url) : undefined,
        edit_instructions: String(input.edit_instructions ?? ''),
        base_label: String(input.base_label ?? 'image'),
        output_label: String(input.output_label ?? 'edited-image'),
      },
      prompt: meta.prompt ?? '',
      requestOrigin: meta.requestOrigin ?? '',
      authCookie: meta.authCookie ?? null,
      productTitle: meta.productTitle ?? product.title,
      productCategory: meta.productCategory ?? product.category,
    });

    // Mark job as success
    await markGenerationJobSuccess(teamId, jobId, result.generation.id, {
      current: 1,
      total: 1,
      completedImageIds: [result.image.id],
    });

    return { success: true };
  } catch (err: any) {
    const errorMessage = err?.message ? String(err.message).slice(0, 500) : 'Edit failed';
    await markGenerationJobFailed(teamId, jobId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate a zip file containing all images from a batch.
 * Used when a generation job completes with multiple images.
 */
export async function generateBatchZip(
  images: VariantImage[],
  jobId: number,
  teamId: number
): Promise<string> {
  const zip = new JSZip();

  // Fetch each image and add to zip
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image ${i + 1}: ${image.url}`);
    }

    const imageBuffer = await response.arrayBuffer();
    // Extract extension from URL or default to png
    const urlParts = image.url.split('.');
    const ext = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0].toLowerCase() : 'png';
    const filename = `image-${i + 1}.${ext}`;

    zip.file(filename, imageBuffer);
  }

  // Generate zip file as buffer
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }, // Balance between size and speed
  });

  // Upload to Vercel Blob storage
  const pathname = `team-${teamId}/generations/${jobId}/batch.zip`;
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  const putRes = await put(pathname, blob, {
    access: 'public',
    contentType: 'application/zip',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  } as any);

  return putRes.url;
}
