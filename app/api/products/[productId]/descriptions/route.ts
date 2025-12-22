import { z } from 'zod';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { getProductById, listProductDescriptions, createProductDescription } from '@/lib/db/products';
import { checkCredits, deductCredits } from '@/lib/payments/credits';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const pid = parseId(productId);
  if (!pid) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  const items = await listProductDescriptions(team.id, pid);
  return Response.json({
    items,
    selectedDescriptionId: product.selectedDescriptionId ?? null,
  });
}

const createSchema = z.object({
  prompt: z.string().min(1).max(2000),
  tone: z.enum(['premium', 'playful', 'minimal']).optional().nullable(),
  length: z.enum(['short', 'medium', 'long']).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { productId } = await params;
  const pid = parseId(productId);
  if (!pid) return Response.json({ error: 'Invalid productId' }, { status: 400 });

  const product = await getProductById(team.id, pid);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  // Check credits before generation
  const creditCheck = await checkCredits(team.id, 'text', 1);
  
  if (!creditCheck.allowed) {
    return Response.json(
      {
        error: 'insufficient_credits',
        reason: creditCheck.reason,
        remaining: creditCheck.remaining,
        required: 1,
        upgradeUrl: '/dashboard/subscription',
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

  const description = await createProductDescription({
    teamId: team.id,
    productId: pid,
    prompt: parsed.data.prompt,
    tone: parsed.data.tone ?? null,
    length: parsed.data.length ?? null,
    productTitle: product.title,
    productCategory: product.category,
    productImageUrl: product.imageUrl ?? null,
  });

  // Deduct credits after successful generation
  const user = await getUser();
  if (creditCheck.creditsId) {
    await deductCredits(team.id, user?.id ?? null, 'text', 1, {
      isOverage: creditCheck.isOverage,
      creditsId: creditCheck.creditsId,
      referenceType: 'product_description',
      referenceId: description.id,
    });
  }

  return Response.json({ description }, { status: 201 });
}

