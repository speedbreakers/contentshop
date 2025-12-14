import { getTeamForUser } from '@/lib/db/queries';
import { getCreditBalance } from '@/lib/payments/credits';
import { getTeamPlanTier, getTeamOverageSettings } from '@/lib/db/credits';
import { PLANS, type PlanTier } from '@/lib/payments/plans';

export const runtime = 'nodejs';

export async function GET() {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const balance = await getCreditBalance(team.id);
  const planTier = await getTeamPlanTier(team.id);
  const overageSettings = await getTeamOverageSettings(team.id);

  if (!balance) {
    return Response.json({
      hasSubscription: false,
      planTier: null,
      imageCredits: { used: 0, included: 0, remaining: 0 },
      textCredits: { used: 0, included: 0, remaining: 0 },
      overage: { imageUsed: 0, textUsed: 0 },
      overageEnabled: overageSettings.overageEnabled,
      overageLimitCents: overageSettings.overageLimitCents,
      periodEnd: null,
      daysRemaining: 0,
    });
  }

  // Calculate overage cost if any
  let overageCostCents = 0;
  if (planTier && planTier in PLANS) {
    const plan = PLANS[planTier as PlanTier];
    overageCostCents = 
      balance.overage.imageUsed * plan.overageImageCents +
      balance.overage.textUsed * plan.overageTextCents;
  }

  return Response.json({
    ...balance,
    planTier,
    overageEnabled: overageSettings.overageEnabled,
    overageLimitCents: overageSettings.overageLimitCents,
    overageCostCents,
    // Calculate percentage used for visual indicators
    imagePercentUsed: balance.imageCredits.included > 0 
      ? Math.round((balance.imageCredits.used / balance.imageCredits.included) * 100)
      : 0,
    textPercentUsed: balance.textCredits.included > 0
      ? Math.round((balance.textCredits.used / balance.textCredits.included) * 100)
      : 0,
  });
}

