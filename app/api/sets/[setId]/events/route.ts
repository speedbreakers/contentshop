import { desc, eq } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { setEvents } from '@/lib/db/schema';

function parseId(param: string) {
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const team = await getTeamForUser();
  if (!team) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { setId } = await params;
  const sid = parseId(setId);
  if (!sid) return Response.json({ error: 'Invalid setId' }, { status: 400 });

  const events = await db
    .select()
    .from(setEvents)
    .where(eq(setEvents.setId, sid))
    .orderBy(desc(setEvents.createdAt))
    .limit(50);

  return Response.json({ items: events });
}


