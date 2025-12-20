import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { variantGenerations, productVariants, products } from '@/lib/db/schema';
import { createVariantGenerationWithProvidedOutputs } from '@/lib/db/generations';
import { classifyGarmentViews } from '@/lib/ai/apparel/classify-garment';
import { maskGarmentsIfNeeded } from '@/lib/ai/apparel/mask-garment';
import { analyzeGarment } from '@/lib/ai/apparel/analyze-garment';
import { resolveCatalogBackground } from '@/lib/ai/background/resolve-catalog-background';
import { generateApparelCatalogImages } from '@/lib/ai/apparel/generate-catalog-images';

export async function executeApparelCatalogWorkflow(args: {
  teamId: number;
  productId: number;
  variantId: number;
  requestOrigin: string;
  authCookie?: string | null;
  moodboard?: {
    id: number;
    name: string;
    styleProfile: Record<string, unknown>;
    assetFileIds: number[];
    assetUrls: string[]; // backward-compat: positive refs
    positiveAssetUrls: string[];
    negativeAssetUrls: string[];
    positiveSummary: string;
    negativeSummary: string;
    strength: 'strict' | 'inspired';
    styleAppendix: string;
  } | null;
  schemaKey: string; // apparel.catalog.v1
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

  // Step 1: classify garment views
  const productImages: string[] = Array.isArray((args.input as any)?.product_images)
    ? (args.input as any).product_images
    : [];
  if (productImages.length === 0) throw new Error('product_images is required');

  const classification = await classifyGarmentViews({
    requestOrigin: args.requestOrigin,
    productImageUrls: productImages,
    authCookie: args.authCookie,
  });

  // Step 2: optional masking
  const masking = await maskGarmentsIfNeeded({
    requestOrigin: args.requestOrigin,
    teamId: args.teamId,
    variantId: args.variantId,
    generationId: gen.id,
    needMasking: Boolean(classification.need_masking),
    frontUrl: classification.frontUrl,
    backUrl: classification.backUrl,
    authCookie: args.authCookie,
  });

  const frontForAnalysis = masking.frontMaskedUrl || classification.frontUrl || productImages[0];

  // Step 3: analyze garment
  const analysis = await analyzeGarment({
    requestOrigin: args.requestOrigin,
    frontImageUrl: String(frontForAnalysis),
    authCookie: args.authCookie,
  });

  // Step 4: resolve background from custom instructions (fallback to studio)
  const customInstructions = String((args.input as any)?.custom_instructions ?? '');
  const background = await resolveCatalogBackground({ instructions: customInstructions });

  // Step 5: generate final images
  const garmentImageUrls = [
    masking.frontMaskedUrl || classification.frontUrl,
    masking.backMaskedUrl || classification.backUrl,
    classification.frontCloseUrl,
    classification.backCloseUrl,
  ].filter(Boolean) as string[];

  const moodboardStrength = args.moodboard?.strength ?? 'inspired';
  const positiveMoodboardImageUrls = (args.moodboard?.positiveAssetUrls ?? args.moodboard?.assetUrls ?? []).filter(
    Boolean
  );
  const negativeMoodboardImageUrls =
    moodboardStrength === 'strict' ? (args.moodboard?.negativeAssetUrls ?? []).filter(Boolean) : [];

  const { outputs, finalPrompt } = await generateApparelCatalogImages({
    requestOrigin: args.requestOrigin,
    authCookie: args.authCookie,
    teamId: args.teamId,
    variantId: args.variantId,
    generationId: gen.id,
    numberOfVariations: args.numberOfVariations,
    garmentImageUrls,
    positiveMoodboardImageUrls,
    negativeMoodboardImageUrls,
    styleAppendix: args.moodboard?.styleAppendix ?? '',
    positiveReferenceSummary: args.moodboard?.positiveSummary ?? '',
    negativeReferenceSummary: moodboardStrength === 'strict' ? args.moodboard?.negativeSummary ?? '' : '',
    analysis,
    background_description: background.background_description,
    custom_instructions: customInstructions,
  });

  // Persist pipeline metadata into generation input.
  const enrichedInput = {
    ...(args.input ?? {}),
    moodboard_snapshot: args.moodboard
      ? {
          id: args.moodboard.id,
          name: args.moodboard.name,
          style_profile: args.moodboard.styleProfile,
          asset_file_ids: args.moodboard.assetFileIds,
        }
      : null,
    pipeline: {
      classification,
      masking,
      analysis,
      background,
      styleAppendix: args.moodboard?.styleAppendix ?? '',
      finalPrompt,
    },
  };

  const saved = await createVariantGenerationWithProvidedOutputs({
    teamId: args.teamId,
    productId: args.productId,
    variantId: args.variantId,
    schemaKey: args.schemaKey,
    input: enrichedInput,
    numberOfVariations: args.numberOfVariations,
    prompts: Array(args.numberOfVariations).fill(finalPrompt), // Same prompt for all variations in pipeline
    generationId: gen.id,
    moodboardId: args.moodboard?.id ?? null,
    outputs: outputs.map((o, idx) => ({ blobUrl: o.blobUrl, prompt: finalPrompt })),
  });

  return saved;
}


