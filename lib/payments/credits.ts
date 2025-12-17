import {
  getCurrentTeamCredits,
  incrementCreditUsage,
  createUsageRecord,
  createTeamCredits,
  getTeamOverageSettings,
  getTeamPlanTier,
} from '@/lib/db/credits';
import { PLANS, type PlanTier, calculateOverageCost } from './plans';
import { stripe } from './stripe';

export type CreditCheckResult = {
  allowed: boolean;
  remaining: number;
  isOverage: boolean;
  overageCount?: number;
  overageCost?: number;
  reason?: 'no_subscription' | 'no_credits' | 'overage_disabled' | 'limit_reached';
  creditsId?: number;
};

export type UsageType = 'image' | 'text';

/**
 * Check if a team has sufficient credits for a generation
 */
export async function checkCredits(
  teamId: number,
  usageType: UsageType,
  count: number = 1
): Promise<CreditCheckResult> {
  // Get current credit period
  const credits = await getCurrentTeamCredits(teamId);
  
  if (!credits) {
    return {
      allowed: false,
      remaining: 0,
      isOverage: false,
      reason: 'no_subscription',
    };
  }

  // Calculate remaining credits
  const included = usageType === 'image' 
    ? credits.imageCreditsIncluded 
    : credits.textCreditsIncluded;
  const used = usageType === 'image' 
    ? credits.imageCreditsUsed 
    : credits.textCreditsUsed;
  const remaining = included - used;

  // If user has enough credits, allow
  if (remaining >= count) {
    return {
      allowed: true,
      remaining: remaining - count,
      isOverage: false,
      creditsId: credits.id,
    };
  }

  // Check if overage is enabled
  const overageSettings = await getTeamOverageSettings(teamId);
  
  if (!overageSettings.overageEnabled) {
    return {
      allowed: false,
      remaining: Math.max(0, remaining),
      isOverage: false,
      reason: 'overage_disabled',
      creditsId: credits.id,
    };
  }

  // Calculate overage needed
  const overageCount = count - Math.max(0, remaining);
  
  // Get plan tier for overage pricing
  const planTier = await getTeamPlanTier(teamId);
  if (!planTier || !(planTier in PLANS)) {
    return {
      allowed: false,
      remaining: Math.max(0, remaining),
      isOverage: false,
      reason: 'no_subscription',
      creditsId: credits.id,
    };
  }

  const overageCost = calculateOverageCost(planTier as PlanTier, usageType, overageCount);

  // Check overage spending limit
  if (overageSettings.overageLimitCents !== null) {
    const currentOverageSpent = calculateCurrentOverageSpent(credits, planTier as PlanTier);
    if (currentOverageSpent + overageCost > overageSettings.overageLimitCents) {
      return {
        allowed: false,
        remaining: Math.max(0, remaining),
        isOverage: true,
        overageCount,
        overageCost,
        reason: 'limit_reached',
        creditsId: credits.id,
      };
    }
  }

  return {
    allowed: true,
    remaining: 0,
    isOverage: true,
    overageCount,
    overageCost,
    creditsId: credits.id,
  };
}

/**
 * Calculate current overage spending for a credit period
 */
function calculateCurrentOverageSpent(
  credits: {
    imageOverageUsed: number;
    textOverageUsed: number;
  },
  tier: PlanTier
): number {
  const plan = PLANS[tier];
  return (
    credits.imageOverageUsed * plan.overageImageCents +
    credits.textOverageUsed * plan.overageTextCents
  );
}

/**
 * Deduct credits and record usage
 */
export async function deductCredits(
  teamId: number,
  userId: number | null,
  usageType: UsageType,
  count: number,
  options: {
    isOverage: boolean;
    creditsId: number;
    referenceType?: string;
    referenceId?: number;
  }
): Promise<void> {
  const { isOverage, creditsId, referenceType, referenceId } = options;

  // Update credit counters
  await incrementCreditUsage(creditsId, usageType, count, isOverage);

  // Create usage record
  await createUsageRecord({
    teamId,
    userId,
    teamCreditsId: creditsId,
    usageType,
    referenceType,
    referenceId,
    creditsUsed: count,
    isOverage,
  });

  // If overage, report to Stripe for metered billing
  if (isOverage) {
    await reportOverageToStripe(teamId, usageType, count);
  }
}

/**
 * Refund credits (inverse of deductCredits) and record the refund as a usage record.
 * Note: This adjusts internal counters only. Overage billing refunds are not reported to Stripe here.
 */
export async function refundCredits(
  teamId: number,
  userId: number | null,
  usageType: UsageType,
  count: number,
  options: {
    isOverage: boolean;
    creditsId: number;
    referenceType?: string;
    referenceId?: number;
  }
): Promise<void> {
  const { isOverage, creditsId, referenceType, referenceId } = options;
  const n = Math.max(0, Math.floor(count || 0));
  if (n <= 0) return;

  // Decrement credit counters
  await incrementCreditUsage(creditsId, usageType, -n, isOverage);

  // Create usage record with negative creditsUsed (audit trail)
  await createUsageRecord({
    teamId,
    userId,
    teamCreditsId: creditsId,
    usageType,
    referenceType: referenceType ?? 'batch_refund',
    referenceId,
    creditsUsed: -n,
    isOverage,
  } as any);
}

/**
 * Meter event names - must match what's configured in Stripe
 */
const METER_EVENTS = {
  image: process.env.STRIPE_IMAGE_METER_EVENT || 'content_shop_image_generation',
  text: process.env.STRIPE_TEXT_METER_EVENT || 'content_shop_text_generation',
};

/**
 * Report overage usage to Stripe using Billing Meter Events API
 * This is the new API required for Stripe API version 2025+
 */
export async function reportOverageToStripe(
  teamId: number,
  usageType: UsageType,
  quantity: number
): Promise<string | null> {
  try {
    // Get the Stripe customer ID for this team
    const { db } = await import('@/lib/db/drizzle');
    const { teams } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const team = await db
      .select({
        stripeCustomerId: teams.stripeCustomerId,
      })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team[0]?.stripeCustomerId) {
      console.error('No Stripe customer ID for team', teamId);
      return null;
    }

    const eventName = usageType === 'image' 
      ? METER_EVENTS.image 
      : METER_EVENTS.text;

    // Report usage via Billing Meter Events API
    const meterEvent = await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        value: quantity.toString(),
        stripe_customer_id: team[0].stripeCustomerId,
      },
      timestamp: Math.floor(Date.now() / 1000),
    });

    return meterEvent.identifier;
  } catch (error) {
    console.error('Failed to report usage to Stripe:', error);
    return null;
  }
}

/**
 * Provision credits for a new subscription or renewal
 */
export async function provisionCredits(
  teamId: number,
  tier: PlanTier,
  periodStart: Date,
  periodEnd: Date,
  stripeSubscriptionId?: string
): Promise<void> {
  const plan = PLANS[tier];

  await createTeamCredits({
    teamId,
    periodStart,
    periodEnd,
    stripeSubscriptionId,
    imageCreditsIncluded: plan.imageCredits,
    textCreditsIncluded: plan.textCredits,
    imageCreditsUsed: 0,
    textCreditsUsed: 0,
    imageOverageUsed: 0,
    textOverageUsed: 0,
  });
}

/**
 * Get credit balance summary for display
 */
export async function getCreditBalance(teamId: number): Promise<{
  hasSubscription: boolean;
  imageCredits: { used: number; included: number; remaining: number };
  textCredits: { used: number; included: number; remaining: number };
  overage: { imageUsed: number; textUsed: number };
  periodEnd: Date | null;
  daysRemaining: number;
} | null> {
  const credits = await getCurrentTeamCredits(teamId);
  
  if (!credits) {
    return null;
  }

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((credits.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    hasSubscription: true,
    imageCredits: {
      used: credits.imageCreditsUsed,
      included: credits.imageCreditsIncluded,
      remaining: Math.max(0, credits.imageCreditsIncluded - credits.imageCreditsUsed),
    },
    textCredits: {
      used: credits.textCreditsUsed,
      included: credits.textCreditsIncluded,
      remaining: Math.max(0, credits.textCreditsIncluded - credits.textCreditsUsed),
    },
    overage: {
      imageUsed: credits.imageOverageUsed,
      textUsed: credits.textOverageUsed,
    },
    periodEnd: credits.periodEnd,
    daysRemaining,
  };
}

