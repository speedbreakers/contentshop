import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { listVariantGenerations } from '@/lib/db/generations';
import { checkCredits, deductCredits } from '@/lib/payments/credits';
import {
  baseGenerationInputSchema,
  getGenerationWorkflow,
  resolveGenerationWorkflowKey,
} from '@/lib/workflows/generation';
import { extractUploadFileId, extractUploadFileIds } from '@/lib/uploads/job-assets';
import { getMoodboardById, listMoodboardAssetsByKind } from '@/lib/db/moodboards';
import { signDownloadToken } from '@/lib/uploads/signing';
import { createGenerationJob, countActiveGenerationJobsForTeam } from '@/lib/db/generation-jobs';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const vid = parseId(variantId);
  if (!vid) return Response.json({ error: 'Invalid variantId' }, { status: 400 });

  const items = await listVariantGenerations(team.id, vid);
  return Response.json({ items });
}

const unifiedInputSchema = baseGenerationInputSchema;

const createSchema = z.object({
  schemaKey: z.string().min(1).max(50),
  input: z.any(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId, variantId } = await params;
  const pid = parseId(productId);
  const vid = parseId(variantId);
  if (!pid || !vid) {
    return Response.json({ error: 'Invalid productId or variantId' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  // Validate unified input (product_images for all categories).
  const ok = unifiedInputSchema.safeParse(parsed.data.input);
  if (!ok.success) {
    return Response.json(
      { error: ok.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const validatedInput = ok.data;
  const workflowKey = resolveGenerationWorkflowKey({
    productCategory: product.category,
    purpose: validatedInput.purpose,
  });
  const workflow = getGenerationWorkflow(workflowKey);
  if (!workflow) return Response.json({ error: 'Unsupported workflow' }, { status: 400 });

  const workflowOk = workflow.inputSchema.safeParse(validatedInput);
  if (!workflowOk.success) {
    return Response.json(
      { error: workflowOk.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const workflowInput = workflowOk.data;
  const schemaKey = workflow.key;
  const numberOfVariations = workflowInput.number_of_variations ?? 1;
  const moodboardStrength = workflowInput.moodboard_strength ?? 'inspired';

  // Optional moodboard enrichment (style profile + reference images)
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
    backgroundAssetUrls: string[];
    modelAssetUrls: string[];
    styleAppendix: string;
  } | null = null;

  if (workflowInput.moodboard_id) {
    const mb = await getMoodboardById(team.id, Number(workflowInput.moodboard_id));
    if (!mb) return Response.json({ error: 'Moodboard not found' }, { status: 404 });

    const backgroundAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'background');
    const modelAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'model');
    const positiveReferenceAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'reference_positive');
    const negativeReferenceAssets = await listMoodboardAssetsByKind(team.id, mb.id, 'reference_negative');
    const exp = Date.now() + 1000 * 60 * 60;
    const backgroundAssetUrls = backgroundAssets.map((a) => {
      const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
      return `/api/uploads/${a.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`;
    });
    const modelAssetUrls = modelAssets.map((a) => {
      const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
      return `/api/uploads/${a.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`;
    });
    const positiveAssetUrls = positiveReferenceAssets.map((a) => {
      const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
      return `/api/uploads/${a.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`;
    });
    const negativeAssetUrls = negativeReferenceAssets.map((a) => {
      const sig = signDownloadToken({ fileId: a.uploadedFileId, teamId: team.id, exp } as any);
      return `/api/uploads/${a.uploadedFileId}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`;
    });

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
      assetUrls: positiveAssetUrls,
      positiveAssetUrls,
      negativeAssetUrls,
      positiveSummary,
      negativeSummary,
      strength: moodboardStrength,
      backgroundAssetFileIds: backgroundAssets.map((a) => a.uploadedFileId),
      modelAssetFileIds: modelAssets.map((a) => a.uploadedFileId),
      positiveAssetFileIds: positiveReferenceAssets.map((a) => a.uploadedFileId),
      negativeAssetFileIds: negativeReferenceAssets.map((a) => a.uploadedFileId),
      backgroundAssetUrls,
      modelAssetUrls,
      styleAppendix,
    };
  }

  // Check credits before generation
  const creditCheck = await checkCredits(team.id, 'image', numberOfVariations);
  
  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: 'insufficient_credits',
        reason: creditCheck.reason,
        remaining: creditCheck.remaining,
        required: numberOfVariations,
        upgradeUrl: '/pricing',
      },
      { status: 402 }
    );
  }

  // If overage required, check if confirmation was provided
  if (creditCheck.isOverage) {
    const confirmOverage = request.headers.get('x-confirm-overage');
    if (confirmOverage !== 'true') {
      return Response.json(
        {
          requiresOverageConfirmation: true,
          overageCount: creditCheck.overageCount,
          overageCost: creditCheck.overageCost,
          remaining: creditCheck.remaining,
        },
        { status: 200 }
      );
    }
  }

  // Rate limit: max 3 active generation jobs per team
  const activeJobCount = await countActiveGenerationJobsForTeam(team.id);
  if (activeJobCount >= 3) {
    return Response.json(
      { error: 'Too many active generation jobs. Please wait for existing jobs to complete.' },
      { status: 429 }
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const user = await getUser();

  // Deduct credits immediately (before queuing)
  // This ensures credits are reserved and prevents over-usage
  if (creditCheck.creditsId) {
    await deductCredits(team.id, user?.id ?? null, 'image', numberOfVariations, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType: 'variant_generation',
      referenceId: undefined, // Will be updated when job completes
    });
  }

  // Build prompts for the workflow (per-variation prompts only)
  const customInstructions = workflowInput.custom_instructions ?? [];
  const prompts = Array.from({ length: numberOfVariations }, (_, idx) => {
    const variationInstruction = customInstructions[idx] || '';
    console.log(`[API] Variation ${idx + 1} instruction: "${variationInstruction}"`);
    const variationInput = {
      ...workflowInput,
      custom_instructions: variationInstruction,
      style_appendix: moodboard?.styleAppendix ?? '',
    };
    return workflow.buildPrompt({
      input: variationInput as any,
      product: { title: product.title, category: product.category },
    });
  });

  // Enforce uploads-only image inputs for background jobs.
  const productImageFileIds = extractUploadFileIds((workflowInput as any)?.product_images ?? []);
  if (productImageFileIds.length !== ((workflowInput as any)?.product_images?.length ?? 0)) {
    return Response.json(
      { error: 'All product_images must be upload-backed URLs (/api/uploads/:id/file)' },
      { status: 400 }
    );
  }

  const modelImageRaw = String((workflowInput as any)?.model_image ?? '').trim();
  const modelImageFileId = modelImageRaw ? extractUploadFileId(modelImageRaw) : null;
  if (modelImageRaw && !modelImageFileId) {
    return Response.json(
      { error: 'model_image must be an upload-backed URL (/api/uploads/:id/file) when provided' },
      { status: 400 }
    );
  }

  const backgroundImageRaw = String((workflowInput as any)?.background_image ?? '').trim();
  const backgroundImageFileId = backgroundImageRaw ? extractUploadFileId(backgroundImageRaw) : null;
  if (backgroundImageRaw && !backgroundImageFileId) {
    return Response.json(
      { error: 'background_image must be an upload-backed URL (/api/uploads/:id/file) when provided' },
      { status: 400 }
    );
  }

  // Create a job instead of processing synchronously
  const job = await createGenerationJob(team.id, {
    productId: pid,
    variantId: vid,
    type: 'image_generation',
    metadata: {
      schemaKey,
      input: {
        // Persist non-image fields, but store image inputs as uploaded_file IDs only.
        ...(workflowInput as any),
        product_images: undefined,
        model_image: undefined,
        background_image: undefined,
        product_image_file_ids: productImageFileIds,
        model_enabled: Boolean(workflowInput.model_enabled),
        ...(modelImageFileId ? { model_image_file_id: modelImageFileId } : {}),
        ...(backgroundImageFileId ? { background_image_file_id: backgroundImageFileId } : {}),
        style_appendix: moodboard?.styleAppendix ?? '',
      },
      numberOfVariations,
      prompts, // Store array of prompts instead of single prompt
      moodboardId: moodboard?.id ?? null,
      requestOrigin,
      productTitle: product.title,
      productCategory: product.category,
      // Store credit info for reference
      creditsId: creditCheck.creditsId,
      isOverage: creditCheck.isOverage,
      // Store whether model should be included (derived from model_image being non-empty)
      modelEnabled: Boolean(workflowInput.model_enabled ?? true),
    },
  });

  if (!job) {
    return Response.json({ error: 'Failed to create generation job' }, { status: 500 });
  }

  return Response.json(
    {
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
      },
      message: 'Generation queued successfully',
    },
    { status: 202 }
  );
}


