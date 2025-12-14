import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { getProductById, listProductDescriptions, createProductDescription } from '@/lib/db/products';

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

  return Response.json({ description }, { status: 201 });
}

