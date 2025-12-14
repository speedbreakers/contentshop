import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { variantImages } from '@/lib/db/schema';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

const patchSchema = z.object({
  output_label: z.string().min(1).max(255),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { imageId } = await params;
  const id = parseId(imageId);
  if (!id) return Response.json({ error: 'Invalid imageId' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const existing = await db.query.variantImages.findFirst({
    where: and(eq(variantImages.teamId, team.id), eq(variantImages.id, id)),
  });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const nextInput =
    existing.input && typeof existing.input === 'object'
      ? { ...(existing.input as Record<string, unknown>), output_label: parsed.data.output_label }
      : { output_label: parsed.data.output_label };

  const [updated] = await db
    .update(variantImages)
    .set({ input: nextInput })
    .where(and(eq(variantImages.teamId, team.id), eq(variantImages.id, id)))
    .returning();

  if (!updated) return Response.json({ error: 'Failed to update' }, { status: 500 });
  return Response.json({ image: updated }, { status: 200 });
}


