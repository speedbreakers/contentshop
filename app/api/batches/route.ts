import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { createSet } from '@/lib/db/sets';
import { createBatch, listBatches, aggregateBatchJobStatus } from '@/lib/db/batches';
import { createGenerationJob } from '@/lib/db/generation-jobs';
import { products, productVariants, sets } from '@/lib/db/schema';
import { checkCredits, deductCredits } from '@/lib/payments/credits';
import {
  baseGenerationInputSchema,
  getGenerationWorkflow,
  resolveGenerationWorkflowKey,
} from '@/lib/workflows/generation';
import { getMoodboardById, listMoodboardAssetsByKind } from '@/lib/db/moodboards';
import { extractUploadFileId, extractUploadFileIds } from '@/lib/uploads/job-assets';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  variants: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        productImageUrls: z.array(z.string().min(1)).min(1).max(4),
      })
    )
    .min(1)
    .max(100),
  settings: z.object({
    numberOfVariations: z.number().int().min(1).max(10),
    input: z.record(z.string(), z.any()).default({}),
  }),
});

export async function GET(_request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await listBatches(team.id, 50);
  const withProgress = await Promise.all(
    items.map(async (b) => ({
      ...b,
      progress: await aggregateBatchJobStatus(team.id, b.id),
    }))
  );

  return Response.json({ items: withProgress });
}

export async function POST(request: Request) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const user = await getUser();

  const variantsInput = parsed.data.variants;
  const variantIds = Array.from(new Set(variantsInput.map((v) => v.variantId)));

  // Validate variants belong to team and are not deleted.
  const variants = await db.query.productVariants.findMany({
    where: and(
      eq(productVariants.teamId, team.id),
      inArray(productVariants.id, variantIds),
      isNull(productVariants.deletedAt)
    ),
    columns: { id: true, productId: true },
  });

  if (variants.length !== variantIds.length) {
    return Response.json({ error: 'One or more variants not found' }, { status: 404 });
  }

  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Preload products (for category/title used in workflow key + prompts)
  const productIds = Array.from(new Set(variants.map((v) => v.productId)));
  const productsRows = await db.query.products.findMany({
    where: and(eq(products.teamId, team.id), inArray(products.id, productIds), isNull(products.deletedAt)),
    columns: { id: true, title: true, category: true },
  });
  const productById = new Map(productsRows.map((p) => [p.id, p]));

  // Optional moodboard enrichment shared across jobs.
  const settingsInput = (parsed.data.settings.input ?? {}) as Record<string, unknown>;
  const numberOfVariations = parsed.data.settings.numberOfVariations;
  const moodboardStrength =
    settingsInput.moodboard_strength === 'strict' || settingsInput.moodboard_strength === 'inspired'
      ? (settingsInput.moodboard_strength as 'strict' | 'inspired')
      : 'inspired';

  let moodboard: {
    id: number;
    name: string;
    styleProfile: Record<string, unknown>;
    assetFileIds: number[];
    assetUrls: string[];
    positiveAssetUrls: string[];
    negativeAssetUrls: string[];
    positiveSummary: string;
    negativeSummary: string;
    strength: 'strict' | 'inspired';
    backgroundAssetFileIds: number[];
    modelAssetFileIds: number[];
    positiveAssetFileIds: number[];
    negativeAssetFileIds: number[];
    styleAppendix: string;
  } | null = null;

  const moodboardIdRaw = settingsInput.moodboard_id;
  if (typeof moodboardIdRaw === 'number' && Number.isFinite(moodboardIdRaw) && moodboardIdRaw > 0) {
    const mb = await getMoodboardById(team.id, Number(moodboardIdRaw));
    if (!mb) return Response.json({ error: 'Moodboard not found' }, { status: 404 });

    const backgroundAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'background');
    const modelAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'model');
    const positiveReferenceAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'reference_positive');
    const negativeReferenceAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'reference_negative');

    const profile = (mb.styleProfile ?? {}) as Record<string, unknown>;
    const typography = (profile.typography ?? {}) as Record<string, unknown>;
    const rules = Array.isArray((typography as any).rules) ? (typography as any).rules : [];
    const doNot = Array.isArray((profile as any).do_not) ? (profile as any).do_not : [];
    const positiveSummary = String((profile as any).reference_positive_summary ?? '');
    const negativeSummary = String((profile as any).reference_negative_summary ?? '');
    const styleAppendix = [
      (typography as any).tone ? `Tone: ${(typography as any).tone}` : '',
      (typography as any).font_family ? `Font family: ${(typography as any).font_family}` : '',
      (typography as any).case ? `Text case: ${(typography as any).case}` : '',
      rules.length ? `Typography rules: ${rules.join('; ')}` : '',
      doNot.length ? `Do not: ${doNot.join('; ')}` : '',
      positiveSummary.trim() ? `Style references (positive): ${positiveSummary.trim()}` : '',
      moodboardStrength === 'strict' && negativeSummary.trim()
        ? `Avoid these styles (negative references): ${negativeSummary.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join(' | ');

    moodboard = {
      id: mb.id,
      name: mb.name,
      styleProfile: profile,
      assetFileIds: [
        ...backgroundAssets.map((a) => a.uploadedFileId),
        ...modelAssets.map((a) => a.uploadedFileId),
        ...positiveReferenceAssets.map((a) => a.uploadedFileId),
        ...negativeReferenceAssets.map((a) => a.uploadedFileId),
      ],
      assetUrls: [],
      positiveAssetUrls: [],
      negativeAssetUrls: [],
      positiveSummary,
      negativeSummary,
      strength: moodboardStrength,
      backgroundAssetFileIds: backgroundAssets.map((a) => a.uploadedFileId),
      modelAssetFileIds: modelAssets.map((a) => a.uploadedFileId),
      positiveAssetFileIds: positiveReferenceAssets.map((a) => a.uploadedFileId),
      negativeAssetFileIds: negativeReferenceAssets.map((a) => a.uploadedFileId),
      styleAppendix,
    };
  }

  // Enforce uploads-only image inputs for background jobs (batch-wide optional images).
  const modelImageRaw = typeof (settingsInput as any)?.model_image === 'string' ? String((settingsInput as any).model_image).trim() : '';
  const modelImageFileId = modelImageRaw ? extractUploadFileId(modelImageRaw) : null;
  if (modelImageRaw && !modelImageFileId) {
    return Response.json(
      { error: 'settings.input.model_image must be an upload-backed URL (/api/uploads/:id/file) when provided' },
      { status: 400 }
    );
  }

  const backgroundImageRaw =
    typeof (settingsInput as any)?.background_image === 'string' ? String((settingsInput as any).background_image).trim() : '';
  const backgroundImageFileId = backgroundImageRaw ? extractUploadFileId(backgroundImageRaw) : null;
  if (backgroundImageRaw && !backgroundImageFileId) {
    return Response.json(
      { error: 'settings.input.background_image must be an upload-backed URL (/api/uploads/:id/file) when provided' },
      { status: 400 }
    );
  }

  // Credits: upfront for all jobs.
  const totalImages = variantIds.length * numberOfVariations;
  const creditCheck = await checkCredits(team.id, 'image', totalImages);
  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: 'insufficient_credits',
        reason: creditCheck.reason,
        remaining: creditCheck.remaining,
        required: totalImages,
        upgradeUrl: '/dashboard/subscription',
      },
      { status: 402 }
    );
  }

  if (creditCheck.creditsId) {
    await deductCredits(team.id, user?.id ?? null, 'image', totalImages, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType: 'variant_generation',
      referenceId: undefined,
    });
  }

  // Create shared batch folder (visible at batch-level).
  const sharedFolder = await createSet(team.id, {
    scopeType: 'batch',
    name: `Batch — ${parsed.data.name}`,
    description: 'Batch outputs',
    productId: null,
    variantId: null,
    createdByUserId: user?.id ?? null,
  });
  if (!sharedFolder) return Response.json({ error: 'Failed to create batch folder' }, { status: 500 });

  // Create batch record.
  const batch = await createBatch(team.id, {
    name: parsed.data.name,
    status: 'queued',
    settings: parsed.data.settings,
    variantCount: variantIds.length,
    imageCount: totalImages,
    folderId: sharedFolder.id,
  });
  if (!batch) return Response.json({ error: 'Failed to create batch' }, { status: 500 });

  // Tag shared folder with batchId for discoverability.
  await db
    .update(sets)
    .set({ batchId: batch.id, updatedAt: new Date() })
    .where(and(eq(sets.teamId, team.id), eq(sets.id, sharedFolder.id)));

  // Create one job per variant.
  const jobs: Array<{ id: number; variantId: number; status: string }> = [];
  for (const v of variantsInput) {
    const variant = variantById.get(v.variantId);
    if (!variant) continue;
    const product = productById.get(variant.productId);
    if (!product) {
      return Response.json({ error: `Product not found for variant ${variant.id}` }, { status: 404 });
    }

    const baseInput = {
      ...settingsInput,
      product_images: v.productImageUrls,
      number_of_variations: numberOfVariations,
    };
    const ok = baseGenerationInputSchema.safeParse(baseInput);
    if (!ok.success) {
      return Response.json(
        { error: ok.error.issues[0]?.message ?? 'Invalid generation settings' },
        { status: 400 }
      );
    }

    const validatedInput = ok.data as any;
    const moodboardStrength = validatedInput.moodboard_strength ?? 'inspired';

    // Enforce uploads-only product image inputs and persist file IDs only.
    const productImageFileIds = extractUploadFileIds(validatedInput.product_images ?? []);
    if (productImageFileIds.length !== (validatedInput.product_images?.length ?? 0)) {
      return Response.json(
        { error: `All productImageUrls must be upload-backed URLs (/api/uploads/:id/file) for variant ${variant.id}` },
        { status: 400 }
      );
    }
    const workflowKey = resolveGenerationWorkflowKey({
      productCategory: product.category,
      purpose: validatedInput.purpose,
    });
    const workflow = getGenerationWorkflow(workflowKey);
    if (!workflow) {
      return Response.json({ error: `Unsupported workflow for ${workflowKey}` }, { status: 400 });
    }

    const customInstructions = Array.isArray(validatedInput.custom_instructions)
      ? validatedInput.custom_instructions
      : [];
    const prompts = Array.from({ length: numberOfVariations }, (_, idx) => {
      const variationInstruction = customInstructions[idx] || '';
      const variationInput = {
        ...validatedInput,
        custom_instructions: variationInstruction,
        style_appendix: moodboard?.styleAppendix ?? '',
      };
      return workflow.buildPrompt({
        input: variationInput as any,
        product: { title: product.title, category: product.category },
      });
    });

    // Per-variant batch folder (visible on variant page).
    const perVariantFolder = await createSet(team.id, {
      scopeType: 'variant',
      name: `Batch — ${parsed.data.name}`,
      description: `Batch outputs for ${parsed.data.name}`,
      productId: variant.productId,
      variantId: variant.id,
      batchId: batch.id,
      createdByUserId: user?.id ?? null,
    });
    if (!perVariantFolder) {
      return Response.json({ error: 'Failed to create per-variant folder' }, { status: 500 });
    }

    const job = await createGenerationJob(team.id, {
      productId: variant.productId,
      variantId: variant.id,
      type: 'image_generation',
      batchId: batch.id,
      metadata: {
        schemaKey: workflow.key,
        input: {
          ...(validatedInput as any),
          product_images: undefined,
          model_image: undefined,
          background_image: undefined,
          product_image_file_ids: productImageFileIds,
          ...(modelImageFileId ? { model_image_file_id: modelImageFileId } : {}),
          ...(backgroundImageFileId ? { background_image_file_id: backgroundImageFileId } : {}),
          style_appendix: moodboard?.styleAppendix ?? '',
        },
        numberOfVariations,
        prompts,
        moodboardId: moodboard?.id ?? null,
        requestOrigin,
        productTitle: product.title,
        productCategory: product.category,
        creditsId: creditCheck.creditsId,
        isOverage: creditCheck.isOverage,
        targetSetId: perVariantFolder.id,
        sharedSetId: sharedFolder.id,
        // Store whether model should be included (derived from model_image being non-empty)
        modelEnabled: Boolean(validatedInput.model_enabled ?? true),
      } as any,
    });
    if (!job) return Response.json({ error: 'Failed to create job' }, { status: 500 });
    jobs.push({ id: job.id, variantId: variant.id, status: job.status });
  }

  return Response.json(
    {
      batch: { id: batch.id, status: batch.status, name: batch.name, folderId: batch.folderId },
      jobs,
    },
    { status: 201 }
  );
}


