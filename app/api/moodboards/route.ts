import { z } from 'zod';
import { getTeamForUser } from '@/lib/db/queries';
import { createMoodboard, listMoodboards } from '@/lib/db/moodboards';

const styleProfileSchema = z.record(z.string(), z.any());

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  style_profile: styleProfileSchema.default({}),
});

export async function GET() {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await listMoodboards(team.id);
  return Response.json({ items });
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

  const created = await createMoodboard(team.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    styleProfile: parsed.data.style_profile ?? {},
  });
  if (!created) return Response.json({ error: 'Failed to create moodboard' }, { status: 500 });
  return Response.json({ moodboard: created }, { status: 201 });
}



