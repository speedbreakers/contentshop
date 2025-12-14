import { getTeamForUser } from '@/lib/db/queries';
import { getVariantGenerationById } from '@/lib/db/generations';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { generationId } = await params;
  const id = parseId(generationId);
  if (!id) return Response.json({ error: 'Invalid generationId' }, { status: 400 });

  const generation = await getVariantGenerationById(team.id, id);
  if (!generation) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json({ generation });
}


