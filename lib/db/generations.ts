import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { products, productVariants, setItems, sets, variantGenerations, variantImages } from './schema';
import { put } from '@vercel/blob';
import { generateText } from 'ai';

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
  prompt?: string | null;
};

export type CreateVariantGenerationGeminiInput = CreateVariantGenerationInput & {
  requestOrigin: string;
  productTitle: string;
  productCategory: string;
};

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
  productTitle: string;
  productCategory: string;
};

function resolveUrl(origin: string, maybeRelative: string) {
  if (!maybeRelative) return maybeRelative;
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) return maybeRelative;
  if (maybeRelative.startsWith('/')) return `${origin}${maybeRelative}`;
  return maybeRelative;
}

async function fetchAsBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
  const ab = await res.arrayBuffer();
  return { bytes: new Uint8Array(ab), mimeType };
}

function coerceResultFileToBytes(file: any): { bytes: Uint8Array; mimeType: string } {
  const mimeType = file?.mediaType ?? file?.mimeType ?? 'image/png';
  if (typeof file?.base64 === 'string') {
    return { bytes: new Uint8Array(Buffer.from(file.base64, 'base64')), mimeType };
  }
  if (file?.data instanceof Uint8Array) {
    return { bytes: file.data, mimeType };
  }
  if (file?.data && typeof file.data === 'object' && typeof file.data.length === 'number') {
    return { bytes: new Uint8Array(file.data), mimeType };
  }
  throw new Error('Unsupported result.files entry (no base64/data)');
}

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
      provider: 'gemini',
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!gen) throw new Error('Failed to create generation');

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

    const productImages: string[] = Array.isArray((input.input as any)?.product_images)
      ? (input.input as any).product_images
      : [];
    if (productImages.length === 0) throw new Error('product_images is required');

    const resolved = productImages.map((u) => resolveUrl(input.requestOrigin, String(u)));
    const referenceImages = await Promise.all(resolved.map(fetchAsBytes));

    const prompt =
      (input.prompt?.trim()
        ? `Generate a studio-quality hero product image for \"${input.productTitle}\". ${input.prompt.trim()}`
        : `Generate a studio-quality hero product image for \"${input.productTitle}\".`) +
      ` Category: ${input.productCategory}.`;

    const uploaded: Array<{ blobUrl: string; prompt: string }> = [];

    for (let idx = 0; idx < input.numberOfVariations; idx++) {
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

      uploaded.push({ blobUrl: putRes.url, prompt: input.prompt ?? '' });
    }

    const createdImages = await db
      .insert(variantImages)
      .values(
        uploaded.map((u) => ({
          teamId: input.teamId,
          variantId: input.variantId,
          generationId: gen.id,
          status: 'ready',
          url: u.blobUrl,
          prompt: input.prompt ?? null,
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
    const base = await fetchAsBytes(baseUrl);

    const refUrlRaw = input.input.reference_image_url?.trim?.() ? String(input.input.reference_image_url) : '';
    const refUrl = refUrlRaw ? resolveUrl(input.requestOrigin, refUrlRaw) : '';
    const ref = refUrl ? await fetchAsBytes(refUrl) : null;

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


