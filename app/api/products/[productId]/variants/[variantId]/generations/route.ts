import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getProductById } from '@/lib/db/products';
import { createVariantGenerationWithGeminiOutputs, listVariantGenerations } from '@/lib/db/generations';
import { signVariantImageToken } from '@/lib/uploads/signing';
import { checkCredits, deductCredits } from '@/lib/payments/credits';
import {
  baseGenerationInputSchema,
  getGenerationWorkflow,
  resolveGenerationWorkflowKey,
} from '@/lib/workflows/generation';

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

  const requestOrigin = new URL(request.url).origin;
  const created = workflow.execute
    ? await workflow.execute({
        teamId: team.id,
        productId: pid,
        variantId: vid,
        requestOrigin,
        authCookie: request.headers.get('cookie'),
        input: workflowInput,
        numberOfVariations,
      })
    : await createVariantGenerationWithGeminiOutputs({
        teamId: team.id,
        productId: pid,
        variantId: vid,
        schemaKey,
        input: workflowInput,
        numberOfVariations,
        prompt: workflow.buildPrompt({
          input: workflowInput,
          product: { title: product.title, category: product.category },
        }),
        requestOrigin,
        productTitle: product.title,
        productCategory: product.category,
      });

  // Deduct credits after successful generation
  const user = await getUser();
  if (creditCheck.creditsId) {
    await deductCredits(team.id, user?.id ?? null, 'image', numberOfVariations, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType: 'variant_generation',
      referenceId: created.generation.id,
    });
  }

  // Return signed proxy URLs for created images.
  const exp = Date.now() + 1000 * 60 * 60; // 1 hour
  const images = (created.images ?? []).map((img) => {
    const sig = signVariantImageToken({ imageId: img.id, teamId: team.id, exp });
    return {
      ...img,
      url: `/api/variant-images/${img.id}/file?teamId=${team.id}&exp=${exp}&sig=${sig}`,
    };
  });

  return Response.json({ ...created, images }, { status: 201 });
}


