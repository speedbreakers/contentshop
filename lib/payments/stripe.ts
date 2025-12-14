import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription
} from '@/lib/db/queries';
import { updateTeamPlanTier, updateTeamMeterIds } from '@/lib/db/credits';
import { provisionCredits } from './credits';
import { PLANS, type PlanTier, getPlanTierFromMetadata, TRIAL_PERIOD_DAYS } from './plans';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil'
});

export async function createCheckoutSession({
  team,
  priceId
}: {
  team: Team | null;
  priceId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: Team) {
  if (!team.stripeCustomerId) {
    redirect('/pricing');
  }

  // Fetch all Content Shop products for plan switching
  const products = await stripe.products.list({
    active: true,
    limit: 100,
  });

  // Filter to only subscription products (those with tier metadata)
  const contentShopProducts = products.data.filter(
    (p) => p.metadata?.tier && ['starter', 'growth', 'scale'].includes(p.metadata.tier)
  );

  if (contentShopProducts.length === 0) {
    // Fallback: just use portal without plan switching
    return stripe.billingPortal.sessions.create({
      customer: team.stripeCustomerId,
      return_url: `${process.env.BASE_URL}/dashboard`,
    });
  }

  // Get all prices for these products
  const productConfigs: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] = [];
  
  for (const product of contentShopProducts) {
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      type: 'recurring', // Only subscription prices, not metered
    });

    // Filter to only monthly subscription prices (not metered)
    const subscriptionPrices = prices.data.filter(
      (price) => price.recurring?.usage_type !== 'metered'
    );

    if (subscriptionPrices.length > 0) {
      productConfigs.push({
        product: product.id,
        prices: subscriptionPrices.map((price) => price.id),
      });
    }
  }

  // Create or update portal configuration with all products
  // Always create fresh to ensure all products are included
  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your Content Shop subscription',
    },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price', 'promotion_code'],
        proration_behavior: 'create_prorations',
        products: productConfigs,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: [
            'too_expensive',
            'missing_features',
            'switched_service',
            'unused',
            'other',
          ],
        },
      },
      payment_method_update: {
        enabled: true,
      },
      invoice_history: {
        enabled: true,
      },
    },
  });

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/pricing`,
    configuration: configuration.id,
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    const productId = typeof plan?.product === 'string' 
      ? plan.product 
      : plan?.product?.id;

    if (!productId) {
      console.error('No product ID found in subscription update');
      return;
    }

    // Fetch the full product to get metadata
    const product = await stripe.products.retrieve(productId);
    
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: productId,
      planName: product?.name,
      subscriptionStatus: status
    });

    // Extract plan tier from product metadata
    if (product?.metadata) {
      const tier = getPlanTierFromMetadata(product.metadata);
      if (tier) {
        await updateTeamPlanTier(team.id, tier);
      }
    }
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });
  }
}

/**
 * Handle new subscription creation - provision initial credits
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  // Get plan tier from subscription - need to fetch product to get metadata
  const plan = subscription.items.data[0]?.plan;
  const productId = typeof plan?.product === 'string' 
    ? plan.product 
    : plan?.product?.id;
  
  if (!productId) {
    console.error('No product ID found in subscription');
    return;
  }

  // Fetch the full product to get metadata
  const product = await stripe.products.retrieve(productId);
  
  if (!product?.metadata) {
    console.error('No product metadata found for product:', productId);
    return;
  }

  const tier = getPlanTierFromMetadata(product.metadata);
  if (!tier) {
    console.error('Invalid plan tier in product metadata:', product.metadata);
    return;
  }

  // Update team's plan tier and subscription info
  await updateTeamPlanTier(team.id, tier);
  await updateTeamSubscription(team.id, {
    stripeSubscriptionId: subscription.id,
    stripeProductId: productId,
    planName: product.name,
    subscriptionStatus: subscription.status,
  });

  // Provision credits for the billing period
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  // Type assertion for subscription period properties
  const sub = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    trial_end?: number | null;
  };

  if (sub.current_period_start && sub.current_period_end) {
    periodStart = new Date(sub.current_period_start * 1000);
    periodEnd = new Date(sub.current_period_end * 1000);
  } else if (sub.trial_end) {
    periodStart = now;
    periodEnd = new Date(sub.trial_end * 1000);
  } else {
    periodStart = now;
    periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  await provisionCredits(
    team.id,
    tier,
    periodStart,
    periodEnd,
    subscription.id
  );

  console.log(`Provisioned ${tier} credits for team ${team.id} via webhook`);
}

/**
 * Handle invoice paid - provision credits for renewal
 */
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Type assertion for invoice subscription property
  const invoiceData = invoice as unknown as {
    subscription?: string | { id: string } | null;
    billing_reason?: string;
  };

  // Only process subscription invoices (not one-time payments)
  if (!invoiceData.subscription) {
    return;
  }

  const subscriptionId = typeof invoiceData.subscription === 'string' 
    ? invoiceData.subscription 
    : invoiceData.subscription.id;

  // Fetch the full subscription to get period dates
  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });
  const subscription = subscriptionResponse as Stripe.Subscription;

  const customerId = subscription.customer as string;
  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  // Get plan tier
  const plan = subscription.items.data[0]?.plan;
  const product = plan?.product as Stripe.Product;

  if (!product?.metadata) {
    console.error('No product metadata found');
    return;
  }

  const tier = getPlanTierFromMetadata(product.metadata);
  if (!tier) {
    console.error('Invalid plan tier in product metadata');
    return;
  }

  // Check if this is a renewal (not the first invoice)
  // First invoice is handled by handleSubscriptionCreated
  if (invoiceData.billing_reason === 'subscription_cycle') {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    // Type assertion for subscription period properties
    const sub = subscription as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };

    if (sub.current_period_start && sub.current_period_end) {
      periodStart = new Date(sub.current_period_start * 1000);
      periodEnd = new Date(sub.current_period_end * 1000);
    } else {
      periodStart = now;
      periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    await provisionCredits(
      team.id,
      tier,
      periodStart,
      periodEnd,
      subscription.id
    );

    console.log(`Renewed ${tier} credits for team ${team.id}`);
  }
}

/**
 * Get products with plan metadata for pricing page
 */
export async function getStripeProductsWithPlans() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  });

  return products.data
    .filter(product => product.metadata?.tier)
    .map(product => {
      const tier = product.metadata.tier as PlanTier;
      const planConfig = PLANS[tier];
      const defaultPrice = product.default_price as Stripe.Price | null;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        tier,
        priceId: defaultPrice?.id,
        unitAmount: defaultPrice?.unit_amount ?? planConfig?.priceMonthly,
        interval: defaultPrice?.recurring?.interval ?? 'month',
        features: planConfig?.features ?? [],
        imageCredits: planConfig?.imageCredits ?? 0,
        textCredits: planConfig?.textCredits ?? 0,
        overageImageCents: planConfig?.overageImageCents ?? 0,
        overageTextCents: planConfig?.overageTextCents ?? 0,
        recommended: 'recommended' in planConfig ? planConfig.recommended : false,
      };
    })
    .sort((a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0));
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}
