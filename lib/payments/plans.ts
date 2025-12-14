/**
 * Plan definitions for the hybrid subscription + credits model.
 * Each tier includes monthly credits and per-unit overage rates.
 */

export const PLANS = {
  starter: {
    name: 'Starter',
    priceMonthly: 2900, // $29.00 in cents
    imageCredits: 50,
    textCredits: 100,
    overageImageCents: 50, // $0.50 per image
    overageTextCents: 10, // $0.10 per text
    features: [
      '50 image generations/month',
      '100 text generations/month',
      'All product categories',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    priceMonthly: 7900, // $79.00 in cents
    imageCredits: 200,
    textCredits: 500,
    overageImageCents: 40, // $0.40 per image
    overageTextCents: 8, // $0.08 per text
    features: [
      '200 image generations/month',
      '500 text generations/month',
      'All product categories',
      'Priority support',
      'Early access to new features',
    ],
    recommended: true,
  },
  scale: {
    name: 'Scale',
    priceMonthly: 19900, // $199.00 in cents
    imageCredits: 600,
    textCredits: 1500,
    overageImageCents: 30, // $0.30 per image
    overageTextCents: 5, // $0.05 per text
    features: [
      '600 image generations/month',
      '1500 text generations/month',
      'All product categories',
      '24/7 priority support',
      'Early access to new features',
      'Dedicated account manager',
    ],
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanTier];

/**
 * Get plan details by tier name
 */
export function getPlan(tier: PlanTier): Plan {
  return PLANS[tier];
}

/**
 * Get plan tier from Stripe product metadata
 */
export function getPlanTierFromMetadata(metadata: Record<string, string>): PlanTier | null {
  const tier = metadata.tier as PlanTier | undefined;
  if (tier && tier in PLANS) {
    return tier;
  }
  return null;
}

/**
 * Calculate overage cost for a given tier and usage type
 */
export function calculateOverageCost(
  tier: PlanTier,
  usageType: 'image' | 'text',
  count: number
): number {
  const plan = PLANS[tier];
  const rateInCents = usageType === 'image' ? plan.overageImageCents : plan.overageTextCents;
  return rateInCents * count;
}

/**
 * Format price in dollars from cents
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get trial period in days
 */
export const TRIAL_PERIOD_DAYS = 14;

