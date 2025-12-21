import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { variantGenerations, productVariants, products } from '@/lib/db/schema';
import { createVariantGenerationWithProvidedOutputs } from '@/lib/db/generations';
import { classifyGarmentViews } from '@/lib/ai/apparel/classify-garment';
import { maskGarmentsIfNeeded } from '@/lib/ai/apparel/mask-garment';
import { analyzeGarment } from '@/lib/ai/apparel/analyze-garment';
import { resolveCatalogBackground } from '@/lib/ai/background/resolve-catalog-background';
import { generateApparelCatalogImages } from '@/lib/ai/apparel/generate-catalog-images';
import { resolveCatalogModel } from '@/lib/ai/model/resolve-catalog-model';

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
    /** All moodboard uploaded_file ids across all sections (for auditing). */
    assetFileIds: number[];
    /** Kind-separated uploaded_file ids (deterministic; used to persist snapshot). */
    backgroundAssetFileIds: number[];
    modelAssetFileIds: number[];
    positiveAssetFileIds: number[];
    negativeAssetFileIds: number[];

    /** Backward-compat alias for positive refs. Prefer positiveAssetUrls. */
    assetUrls: string[];
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

  // Step 1: resolve product images from uploaded_file ids (IDs-only contract)
  const productImages = args.input.product_images;
  if (!productImages.length) throw new Error('product_images is required');

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

  const customInstructions = Array.isArray((args.input as any)?.custom_instructions)
  ? ((args.input as any).custom_instructions as any[]).map((s) => String(s)).join('\n')
  : String((args.input as any)?.custom_instructions ?? '');
  
  // Step 4: resolve background prompt with priority:
  const moodboardBackgroundSummary = String((args.moodboard?.styleProfile as any)?.backgrounds_analysis_summary ?? '');

  const background = await resolveCatalogBackground({
    backgroundImageUrl: args.input.background_image,
    custom_instructions: customInstructions,
    moodboard_background_summary: moodboardBackgroundSummary,
  });

  // Step 4b: resolve model guidance (only if model_enabled)
  const modelEnabled = Boolean((args.input as any)?.model_enabled ?? true);
  const moodboardModelSummary = String((args.moodboard?.styleProfile as any)?.models_analysis_summary ?? '');
  const resolvedModel = modelEnabled && !args.input.model_image
    ? await resolveCatalogModel({
        custom_instructions: customInstructions,
        moodboard_model_summary: moodboardModelSummary,
      })
    : null;

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
    authCookie: args.authCookie ?? null,
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
    model_enabled: modelEnabled,
    model_description: resolvedModel?.model_description ?? '',
    modelImageUrl: args.input.model_image,
  });

  // Persist pipeline metadata into generation input.
  const enrichedInput = {
    ...(args.input ?? {}),
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


