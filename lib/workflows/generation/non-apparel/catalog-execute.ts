import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { variantGenerations, productVariants, products } from '@/lib/db/schema';
import { createVariantGenerationWithProvidedOutputs } from '@/lib/db/generations';
import { resolveCatalogBackground, STUDIO_DEFAULT_BACKGROUND } from '@/lib/ai/background/resolve-catalog-background';
import { resolveCatalogModel } from '@/lib/ai/model/resolve-catalog-model';
import { generateNonApparelShootImages } from '@/lib/ai/non-apparel/generate-shoot-images';

export async function executeNonApparelCatalogWorkflow(args: {
  teamId: number;
  productId: number;
  variantId: number;
  requestOrigin: string;
  authCookie?: string | null;
  moodboard?: {
    id: number;
    name: string;
    styleProfile: Record<string, unknown>;
    backgroundAssetFileIds: number[];
    modelAssetFileIds: number[];
    positiveAssetFileIds: number[];
    negativeAssetFileIds: number[];
    assetUrls: string[];
    positiveAssetUrls: string[];
    negativeAssetUrls: string[];
  } | null;
  schemaKey: string; // non_apparel.catalog.v1
  input: any; // validated input schema
  numberOfVariations: number;
}) {
  const now = new Date();

  // Validate ownership (defense in depth).
  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.teamId, args.teamId),
      eq(productVariants.productId, args.productId),
      eq(productVariants.id, args.variantId),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true },
  });
  if (!variant) throw new Error('Variant not found');

  const product = await db.query.products.findFirst({
    where: and(eq(products.teamId, args.teamId), eq(products.id, args.productId), isNull(products.deletedAt)),
    columns: { id: true, title: true, category: true },
  });
  if (!product) throw new Error('Product not found');

  // Create generation record early to get an ID for storing intermediate artifacts.
  const [gen] = await db
    .insert(variantGenerations)
    .values({
      teamId: args.teamId,
      variantId: args.variantId,
      schemaKey: args.schemaKey,
      input: args.input ?? {},
      numberOfVariations: args.numberOfVariations,
      provider: 'gemini',
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!gen) throw new Error('Failed to create generation');

  // Step 1: Inputs
  // Note: inputs are already hydrated to blob URLs by the worker
  const productImages = args.input.product_images;
  if (!productImages.length) throw new Error('product_images is required');

  const customInstructionsRaw = args.input.custom_instructions;
  const customInstructionsArray: string[] = Array.isArray(customInstructionsRaw)
    ? customInstructionsRaw.map(String)
    : [String(customInstructionsRaw || '')].filter(Boolean);
  
  const customInstructionsText = customInstructionsArray.join('\n');

  // Step 2: Resolve Background
  const background = await resolveCatalogBackground({
    backgroundImageUrl: args.input.background_image,
    custom_instructions: customInstructionsText,
    moodboardStrength: args.input.moodboard_strength,
    moodboard: args.moodboard,
  });

  // Step 3: Resolve Model (if enabled)
  const modelEnabled = Boolean(args.input.model_enabled ?? true);
  const resolvedModel = modelEnabled && !args.input.model_image
    ? await resolveCatalogModel({
        custom_instructions: customInstructionsText,
        moodboardStrength: args.input.moodboard_strength,
        moodboard: args.moodboard,
      })
    : null;

  // Step 4: Generate Images (Anchor Loop)
  const { outputs } = await generateNonApparelShootImages({
    requestOrigin: args.requestOrigin,
    authCookie: args.authCookie,
    teamId: args.teamId,
    variantId: args.variantId,
    generationId: gen.id,
    numberOfVariations: args.numberOfVariations,
    productImageUrls: productImages,
    model_enabled: modelEnabled,
    model_description: resolvedModel?.model_description ?? '',
    modelImageUrl: args.input.model_image,
    styleAppendix: String(args.input?.style_appendix ?? ''),
    positiveReferenceSummary: String(args.moodboard?.styleProfile.reference_positive_summary ?? ''),
    negativeReferenceSummary: String(args.input.moodboard_strength === 'strict' ? args.moodboard?.styleProfile.reference_negative_summary ?? '' : ''),
    background_description: background.background_description,
    custom_instructions: customInstructionsArray,
    aspect_ratio: args.input.aspect_ratio ?? '1:1',
  });

  // Persist pipeline metadata into generation input.
  // Note: We don't have analysis/masking here like apparel, but we save background/model resolution.
  const enrichedInput = {
    ...(args.input ?? {}),
    pipeline: {
      background,
      resolvedModel,
      styleAppendix: String(args.input?.style_appendix ?? ''),
      // We could store final prompts here if desired, but they are stored per-image in outputs
    },
  };

  const saved = await createVariantGenerationWithProvidedOutputs({
    teamId: args.teamId,
    productId: args.productId,
    variantId: args.variantId,
    schemaKey: args.schemaKey,
    input: enrichedInput,
    numberOfVariations: args.numberOfVariations,
    prompts: outputs.map(o => o.prompt), 
    generationId: gen.id,
    moodboardId: args.moodboard?.id ?? null,
    outputs: outputs.map((o) => ({ blobUrl: o.blobUrl, prompt: o.prompt })),
  });

  return saved;
}

