import { getTeamForUser } from '@/lib/db/queries';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { setId } = await params;
  const sid = parseId(setId);
  if (!sid) return Response.json({ error: 'Invalid setId' }, { status: 400 });

  // Mock for now. Later: create sync_job + sync_logs and push selected assets.
  return Response.json({ ok: true, setId: sid });
}


