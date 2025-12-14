import { checkoutAction } from '@/lib/payments/actions';
import { Check, ImageIcon, FileTextIcon, Sparkles } from 'lucide-react';
import { getStripeProductsWithPlans } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { PLANS, TRIAL_PERIOD_DAYS, formatPrice } from '@/lib/payments/plans';

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  let stripeProducts;
  try {
    stripeProducts = await getStripeProductsWithPlans();
  } catch {
    stripeProducts = null;
  }

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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Choose the plan that fits your content needs. All plans include a{' '}
          {TRIAL_PERIOD_DAYS}-day free trial.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <PricingCard
            key={plan.tier}
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
          />
        ))}
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
                    className="text-center py-4 px-4 font-medium text-gray-900 dark:text-gray-100"
                  >
                    {plan.name}
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
                    className="py-4 px-4 text-center font-medium text-gray-900 dark:text-gray-100"
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
                    className="py-4 px-4 text-center font-medium text-gray-900 dark:text-gray-100"
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
                    className="py-4 px-4 text-center text-gray-600 dark:text-gray-400"
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
                    className="py-4 px-4 text-center text-gray-600 dark:text-gray-400"
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
}: {
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
}) {
  return (
    <div
      className={`relative rounded-2xl p-8 ${
        recommended
          ? 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-950 dark:to-gray-900 border-2 border-orange-500 shadow-lg'
          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
      }`}
    >
      {recommended && (
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
        {trialDays}-day free trial
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

      <form action={checkoutAction}>
        <input type="hidden" name="priceId" value={priceId ?? ''} />
        <SubmitButton recommended={recommended} />
      </form>
    </div>
  );
}
