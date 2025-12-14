import { getTeamForUser } from '@/lib/db/queries';
import { getTeamUsageRecords, getCurrentTeamCredits, getUsageStats, getTeamCreditHistory } from '@/lib/db/credits';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const usageType = searchParams.get('type') as 'image' | 'text' | null;
  const view = searchParams.get('view'); // 'history' for credit history

  // Return credit history if requested
  if (view === 'history') {
    const history = await getTeamCreditHistory(team.id, 12);
    return Response.json({
      history: history.map(period => ({
        id: period.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        imageCreditsIncluded: period.imageCreditsIncluded,
        imageCreditsUsed: period.imageCreditsUsed,
        imageOverageUsed: period.imageOverageUsed,
        textCreditsIncluded: period.textCreditsIncluded,
        textCreditsUsed: period.textCreditsUsed,
        textOverageUsed: period.textOverageUsed,
      })),
    });
  }

  // Get usage records for current period
  const records = await getTeamUsageRecords(team.id, {
    limit,
    offset,
    usageType: usageType ?? undefined,
  });

  // Get current period stats
  const currentCredits = await getCurrentTeamCredits(team.id);
  let stats = null;
  
  if (currentCredits) {
    stats = await getUsageStats(currentCredits.id);
  }

  return Response.json({
    records: records.map(record => ({
      id: record.id,
      usageType: record.usageType,
      creditsUsed: record.creditsUsed,
      isOverage: record.isOverage,
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      createdAt: record.createdAt,
    })),
    stats,
    pagination: {
      limit,
      offset,
      hasMore: records.length === limit,
    },
  });
}

