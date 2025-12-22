import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import { Check, ImageIcon, FileTextIcon, Sparkles, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { getStripeProductsWithPlans } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { PLANS, TRIAL_PERIOD_DAYS, formatPrice, type PlanTier } from '@/lib/payments/plans';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Dynamic page - needs user context
export const dynamic = 'force-dynamic';

async function getCurrentSubscription() {
  const user = await getUser();
  if (!user) return null;

  const userTeam = await db
    .select({
      planTier: teams.planTier,
      subscriptionStatus: teams.subscriptionStatus,
      planName: teams.planName,
      stripeSubscriptionId: teams.stripeSubscriptionId,
      stripeCustomerId: teams.stripeCustomerId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (!userTeam[0]) return null;

  // Check if user has ever had a subscription (for trial eligibility)
  let hasHadSubscriptionBefore = false;
  if (userTeam[0].stripeCustomerId) {
    // Import stripe dynamically to avoid issues
    const { stripe } = await import('@/lib/payments/stripe');
    const subscriptions = await stripe.subscriptions.list({
      customer: userTeam[0].stripeCustomerId,
      limit: 1,
      status: 'all',
    });
    hasHadSubscriptionBefore = subscriptions.data.length > 0;
  }

  return {
    planTier: userTeam[0].planTier as PlanTier | null,
    subscriptionStatus: userTeam[0].subscriptionStatus,
    planName: userTeam[0].planName,
    hasSubscription: !!userTeam[0].stripeSubscriptionId && 
      ['active', 'trialing'].includes(userTeam[0].subscriptionStatus ?? ''),
    isEligibleForTrial: !hasHadSubscriptionBefore,
  };
}

const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'scale'];

function getPlanRank(tier: PlanTier): number {
  return PLAN_ORDER.indexOf(tier);
}

export default async function PricingPage() {
  const [stripeProductsResult, subscription] = await Promise.all([
    getStripeProductsWithPlans().catch(() => null),
    getCurrentSubscription(),
  ]);

  const stripeProducts = stripeProductsResult;

  // Fallback to local plan definitions if Stripe products not configured
  const plans = stripeProducts?.length
    ? stripeProducts
    : Object.entries(PLANS).map(([tier, plan]) => ({
        id: tier,
        name: plan.name,
        tier: tier as keyof typeof PLANS,
        priceId: undefined,
        unitAmount: plan.priceMonthly,
        interval: 'month',
        features: plan.features,
        imageCredits: plan.imageCredits,
        textCredits: plan.textCredits,
        overageImageCents: plan.overageImageCents,
        overageTextCents: plan.overageTextCents,
        recommended: 'recommended' in plan ? plan.recommended : false,
      }));

  const currentTier = subscription?.planTier;
  const hasActiveSubscription = subscription?.hasSubscription ?? false;
  const isEligibleForTrial = subscription?.isEligibleForTrial ?? true;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {hasActiveSubscription ? 'Manage your plan' : 'Simple, transparent pricing'}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {hasActiveSubscription ? (
            <>
              You&apos;re currently on the{' '}
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {subscription?.planName || currentTier}
              </span>{' '}
              plan. Upgrade or downgrade anytime.
            </>
          ) : isEligibleForTrial ? (
            <>
              Choose the plan that fits your content needs. All plans include a{' '}
              {TRIAL_PERIOD_DAYS}-day free trial.
            </>
          ) : (
            <>
              Choose the plan that fits your content needs.
            </>
          )}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const planTier = plan.tier;
          const isCurrentPlan = currentTier === planTier;
          const planRank = getPlanRank(planTier);
          const currentRank = currentTier ? getPlanRank(currentTier) : -1;
          
          let action: 'current' | 'upgrade' | 'downgrade' | 'subscribe' = 'subscribe';
          if (hasActiveSubscription) {
            if (isCurrentPlan) {
              action = 'current';
            } else if (planRank > currentRank) {
              action = 'upgrade';
            } else {
              action = 'downgrade';
            }
          }

          return (
            <PricingCard
              key={plan.tier}
              tier={plan.tier}
              name={plan.name}
              price={plan.unitAmount ?? 0}
              interval={plan.interval ?? 'month'}
              trialDays={TRIAL_PERIOD_DAYS}
              imageCredits={plan.imageCredits}
              textCredits={plan.textCredits}
              overageImageCents={plan.overageImageCents}
              overageTextCents={plan.overageTextCents}
              features={plan.features}
              priceId={plan.priceId}
              recommended={plan.recommended}
              action={action}
              hasActiveSubscription={hasActiveSubscription}
              isEligibleForTrial={subscription?.isEligibleForTrial ?? true}
            />
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-8">
          Compare plans
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-4 px-4 font-medium text-gray-900 dark:text-gray-100">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.tier}
                    className={`text-center py-4 px-4 font-medium ${
                      currentTier === plan.tier
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {plan.name}
                    {currentTier === plan.tier && (
                      <span className="block text-xs font-normal text-green-500 mt-0.5">
                        (Current)
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                  Image generations / month
                </td>
                {plans.map((plan) => (
                  <td
                    key={plan.tier}
                    className={`py-4 px-4 text-center font-medium ${
                      currentTier === plan.tier
                        ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {plan.imageCredits}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                  Text generations / month
                </td>
                {plans.map((plan) => (
                  <td
                    key={plan.tier}
                    className={`py-4 px-4 text-center font-medium ${
                      currentTier === plan.tier
                        ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {plan.textCredits}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                  Image overage rate
                </td>
                {plans.map((plan) => (
                  <td
                    key={plan.tier}
                    className={`py-4 px-4 text-center ${
                      currentTier === plan.tier
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {formatPrice(plan.overageImageCents)}/image
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                  Text overage rate
                </td>
                {plans.map((plan) => (
                  <td
                    key={plan.tier}
                    className={`py-4 px-4 text-center ${
                      currentTier === plan.tier
                        ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {formatPrice(plan.overageTextCents)}/text
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function PricingCard({
  tier,
  name,
  price,
  interval,
  trialDays,
  imageCredits,
  textCredits,
  overageImageCents,
  overageTextCents,
  features,
  priceId,
  recommended,
  action,
  hasActiveSubscription,
  isEligibleForTrial,
}: {
  tier: PlanTier;
  name: string;
  price: number;
  interval: string;
  trialDays: number;
  imageCredits: number;
  textCredits: number;
  overageImageCents: number;
  overageTextCents: number;
  features: readonly string[];
  priceId?: string;
  recommended?: boolean;
  action: 'current' | 'upgrade' | 'downgrade' | 'subscribe';
  hasActiveSubscription: boolean;
  isEligibleForTrial: boolean;
}) {
  const isCurrentPlan = action === 'current';

  // Determine subtitle text
  let subtitle = `$${price / 100}/${interval}`;
  if (!hasActiveSubscription) {
    if (isEligibleForTrial) {
      subtitle = `${trialDays}-day free trial`;
    } else {
      subtitle = 'Start immediately';
    }
  }

  return (
    <div
      className={`relative rounded-2xl p-8 ${
        isCurrentPlan
          ? 'bg-gradient-to-b from-green-50 to-white dark:from-green-950 dark:to-gray-900 border-2 border-green-500 shadow-lg'
          : recommended
          ? 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950 dark:to-gray-900 border-2 border-orange-500 shadow-lg'
          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-green-500 text-white rounded-full">
            <Check className="h-3.5 w-3.5" />
            Current Plan
          </span>
        </div>
      )}
      {!isCurrentPlan && recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-orange-500 text-white rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            Recommended
          </span>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {name}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {subtitle}
      </p>

      <p className="mb-6">
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          ${price / 100}
        </span>
        <span className="text-gray-600 dark:text-gray-400">/{interval}</span>
      </p>

      {/* Credits summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <ImageIcon className="h-4 w-4" />
            <span>Image generations</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {imageCredits}/mo
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <FileTextIcon className="h-4 w-4" />
            <span>Text generations</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {textCredits}/mo
          </span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-xs text-gray-500 dark:text-gray-400">
          Overage: {formatPrice(overageImageCents)}/image,{' '}
          {formatPrice(overageTextCents)}/text
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <PlanActionButton
        action={action}
        priceId={priceId}
        recommended={recommended}
      />
    </div>
  );
}

function PlanActionButton({
  action,
  priceId,
  recommended,
}: {
  action: 'current' | 'upgrade' | 'downgrade' | 'subscribe';
  priceId?: string;
  recommended?: boolean;
}) {
  if (action === 'current') {
    return (
      <form action={customerPortalAction}>
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Manage Subscription
        </button>
      </form>
    );
  }

  if (action === 'upgrade') {
    return (
      <form action={customerPortalAction}>
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white transition-colors"
        >
          <ArrowUp className="h-4 w-4" />
          Upgrade to this plan
        </button>
      </form>
    );
  }

  if (action === 'downgrade') {
    return (
      <form action={customerPortalAction}>
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowDown className="h-4 w-4" />
          Downgrade to this plan
        </button>
      </form>
    );
  }

  // Subscribe action
  return (
    <form action={checkoutAction}>
      <input type="hidden" name="priceId" value={priceId ?? ''} />
      <SubmitButton recommended={recommended} />
    </form>
  );
}
