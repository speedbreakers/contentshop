/**
 * Stripe Product & Price Setup Script
 * 
 * This script creates the products, meters, and prices in Stripe for the hybrid payment system.
 * Run with: npx tsx scripts/setup-stripe-products.ts
 * 
 * Prerequisites:
 * - STRIPE_SECRET_KEY environment variable must be set
 * - Run this script once to set up your Stripe account
 */

import Stripe from 'stripe';

// Load environment variables from .env.local if available
import { config } from 'dotenv';
config({ path: '.env.local' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required');
  console.error('   Set it in .env.local or as an environment variable');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

// Plan definitions matching lib/payments/plans.ts
const PLANS = {
  starter: {
    name: 'Content Shop Starter',
    description: 'Perfect for small stores and getting started with AI content generation.',
    priceMonthly: 2900, // $29.00
    imageCredits: 50,
    textCredits: 100,
    overageImageCents: 50, // $0.50
    overageTextCents: 10,  // $0.10
  },
  growth: {
    name: 'Content Shop Growth',
    description: 'For growing brands that need more content at scale.',
    priceMonthly: 7900, // $79.00
    imageCredits: 200,
    textCredits: 500,
    overageImageCents: 40, // $0.40
    overageTextCents: 8,   // $0.08
  },
  scale: {
    name: 'Content Shop Scale',
    description: 'For high-volume stores and agencies with enterprise needs.',
    priceMonthly: 19900, // $199.00
    imageCredits: 600,
    textCredits: 1500,
    overageImageCents: 30, // $0.30
    overageTextCents: 5,   // $0.05
  },
} as const;

type PlanTier = keyof typeof PLANS;

interface CreatedProducts {
  subscriptionProducts: Record<PlanTier, { product: Stripe.Product; price: Stripe.Price }>;
  meters: {
    image: Stripe.Billing.Meter;
    text: Stripe.Billing.Meter;
  };
  overageProducts: {
    image: { product: Stripe.Product; prices: Record<PlanTier, Stripe.Price> };
    text: { product: Stripe.Product; prices: Record<PlanTier, Stripe.Price> };
  };
}

async function checkExistingProducts(): Promise<boolean> {
  console.log('\n📋 Checking for existing products...');
  
  const products = await stripe.products.list({ limit: 100, active: true });
  const existingPlans = products.data.filter(p => p.metadata?.tier && p.metadata.tier in PLANS);
  
  if (existingPlans.length > 0) {
    console.log('\n⚠️  Found existing Content Shop products:');
    existingPlans.forEach(p => {
      console.log(`   - ${p.name} (${p.id}) - tier: ${p.metadata.tier}`);
    });
    return true;
  }
  
  return false;
}

async function checkExistingMeters(): Promise<{ image?: Stripe.Billing.Meter; text?: Stripe.Billing.Meter }> {
  console.log('\n📋 Checking for existing meters...');
  
  const meters = await stripe.billing.meters.list({ limit: 100 });
  const existingMeters: { image?: Stripe.Billing.Meter; text?: Stripe.Billing.Meter } = {};
  
  for (const meter of meters.data) {
    if (meter.event_name === 'content_shop_image_generation') {
      existingMeters.image = meter;
      console.log(`   Found existing image meter: ${meter.id}`);
    }
    if (meter.event_name === 'content_shop_text_generation') {
      existingMeters.text = meter;
      console.log(`   Found existing text meter: ${meter.id}`);
    }
  }
  
  return existingMeters;
}

async function createBillingMeters(existingMeters: { image?: Stripe.Billing.Meter; text?: Stripe.Billing.Meter }): Promise<CreatedProducts['meters']> {
  console.log('\n📊 Creating billing meters...\n');
  
  // Create Image Generation Meter
  let imageMeter = existingMeters.image;
  if (!imageMeter) {
    console.log('   Creating image generation meter...');
    imageMeter = await stripe.billing.meters.create({
      display_name: 'Image Generations',
      event_name: 'content_shop_image_generation',
      default_aggregation: {
        formula: 'sum',
      },
      customer_mapping: {
        type: 'by_id',
        event_payload_key: 'stripe_customer_id',
      },
      value_settings: {
        event_payload_key: 'value',
      },
    });
    console.log(`   ✓ Created image meter: ${imageMeter.id}`);
  } else {
    console.log(`   ✓ Using existing image meter: ${imageMeter.id}`);
  }
  
  // Create Text Generation Meter
  let textMeter = existingMeters.text;
  if (!textMeter) {
    console.log('   Creating text generation meter...');
    textMeter = await stripe.billing.meters.create({
      display_name: 'Text Generations',
      event_name: 'content_shop_text_generation',
      default_aggregation: {
        formula: 'sum',
      },
      customer_mapping: {
        type: 'by_id',
        event_payload_key: 'stripe_customer_id',
      },
      value_settings: {
        event_payload_key: 'value',
      },
    });
    console.log(`   ✓ Created text meter: ${textMeter.id}`);
  } else {
    console.log(`   ✓ Using existing text meter: ${textMeter.id}`);
  }
  
  return { image: imageMeter, text: textMeter };
}

async function createSubscriptionProducts(): Promise<CreatedProducts['subscriptionProducts']> {
  console.log('\n🛍️  Creating subscription products...\n');
  
  const results: Partial<CreatedProducts['subscriptionProducts']> = {};
  
  for (const [tier, config] of Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]) {
    console.log(`   Creating ${tier} plan...`);
    
    // Create the product
    const product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: {
        tier,
        image_credits: config.imageCredits.toString(),
        text_credits: config.textCredits.toString(),
        overage_image_cents: config.overageImageCents.toString(),
        overage_text_cents: config.overageTextCents.toString(),
      },
    });
    
    console.log(`   ✓ Created product: ${product.id}`);
    
    // Create the recurring price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: config.priceMonthly,
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 14,
      },
      metadata: {
        tier,
        type: 'subscription',
      },
    });
    
    console.log(`   ✓ Created price: ${price.id} ($${config.priceMonthly / 100}/month)\n`);
    
    // Set as default price
    await stripe.products.update(product.id, {
      default_price: price.id,
    });
    
    results[tier] = { product, price };
  }
  
  return results as CreatedProducts['subscriptionProducts'];
}

async function createOverageProducts(meters: CreatedProducts['meters']): Promise<CreatedProducts['overageProducts']> {
  console.log('\n📊 Creating metered overage products...\n');
  
  // Create Image Overage Product
  console.log('   Creating image overage product...');
  const imageProduct = await stripe.products.create({
    name: 'Image Generation Overage',
    description: 'Additional image generations beyond your plan limit',
    metadata: {
      type: 'image_overage',
    },
  });
  console.log(`   ✓ Created product: ${imageProduct.id}`);
  
  // Create metered prices for each tier backed by the meter
  const imagePrices: Partial<Record<PlanTier, Stripe.Price>> = {};
  for (const [tier, config] of Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]) {
    const price = await stripe.prices.create({
      product: imageProduct.id,
      currency: 'usd',
      unit_amount: config.overageImageCents,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        meter: meters.image.id,
      },
      billing_scheme: 'per_unit',
      metadata: {
        tier,
        type: 'image_overage',
      },
      nickname: `Image Overage - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
    });
    imagePrices[tier] = price;
    console.log(`   ✓ Created ${tier} image overage price: ${price.id} ($${config.overageImageCents / 100}/image)`);
  }
  
  // Create Text Overage Product
  console.log('\n   Creating text overage product...');
  const textProduct = await stripe.products.create({
    name: 'Text Generation Overage',
    description: 'Additional text generations beyond your plan limit',
    metadata: {
      type: 'text_overage',
    },
  });
  console.log(`   ✓ Created product: ${textProduct.id}`);
  
  // Create metered prices for each tier backed by the meter
  const textPrices: Partial<Record<PlanTier, Stripe.Price>> = {};
  for (const [tier, config] of Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]) {
    const price = await stripe.prices.create({
      product: textProduct.id,
      currency: 'usd',
      unit_amount: config.overageTextCents,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        meter: meters.text.id,
      },
      billing_scheme: 'per_unit',
      metadata: {
        tier,
        type: 'text_overage',
      },
      nickname: `Text Overage - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
    });
    textPrices[tier] = price;
    console.log(`   ✓ Created ${tier} text overage price: ${price.id} ($${config.overageTextCents / 100}/text)`);
  }
  
  return {
    image: { 
      product: imageProduct, 
      prices: imagePrices as Record<PlanTier, Stripe.Price> 
    },
    text: { 
      product: textProduct, 
      prices: textPrices as Record<PlanTier, Stripe.Price> 
    },
  };
}

function printSummary(products: CreatedProducts) {
  console.log('\n' + '='.repeat(60));
  console.log('✅ STRIPE SETUP COMPLETE');
  console.log('='.repeat(60));
  
  console.log('\n📊 BILLING METERS:');
  console.log('-'.repeat(60));
  console.log(`\n   Image Meter`);
  console.log(`   ID: ${products.meters.image.id}`);
  console.log(`   Event Name: ${products.meters.image.event_name}`);
  console.log(`\n   Text Meter`);
  console.log(`   ID: ${products.meters.text.id}`);
  console.log(`   Event Name: ${products.meters.text.event_name}`);
  
  console.log('\n\n📦 SUBSCRIPTION PRODUCTS:');
  console.log('-'.repeat(60));
  for (const [tier, { product, price }] of Object.entries(products.subscriptionProducts)) {
    const config = PLANS[tier as PlanTier];
    console.log(`\n   ${tier.toUpperCase()}`);
    console.log(`   Product ID: ${product.id}`);
    console.log(`   Price ID:   ${price.id}`);
    console.log(`   Amount:     $${config.priceMonthly / 100}/month`);
    console.log(`   Credits:    ${config.imageCredits} images, ${config.textCredits} text`);
  }
  
  console.log('\n\n📊 OVERAGE PRODUCTS:');
  console.log('-'.repeat(60));
  
  console.log('\n   IMAGE OVERAGE');
  console.log(`   Product ID: ${products.overageProducts.image.product.id}`);
  for (const [tier, price] of Object.entries(products.overageProducts.image.prices)) {
    const config = PLANS[tier as PlanTier];
    console.log(`   ${tier} Price ID: ${price.id} ($${config.overageImageCents / 100}/image)`);
  }
  
  console.log('\n   TEXT OVERAGE');
  console.log(`   Product ID: ${products.overageProducts.text.product.id}`);
  for (const [tier, price] of Object.entries(products.overageProducts.text.prices)) {
    const config = PLANS[tier as PlanTier];
    console.log(`   ${tier} Price ID: ${price.id} ($${config.overageTextCents / 100}/text)`);
  }
  
  console.log('\n\n📝 ENVIRONMENT VARIABLES TO ADD:');
  console.log('-'.repeat(60));
  console.log(`
# Add these to your .env.local file:

# Billing Meters
STRIPE_IMAGE_METER_ID=${products.meters.image.id}
STRIPE_TEXT_METER_ID=${products.meters.text.id}
STRIPE_IMAGE_METER_EVENT=${products.meters.image.event_name}
STRIPE_TEXT_METER_EVENT=${products.meters.text.event_name}

# Subscription Price IDs
STRIPE_STARTER_PRICE_ID=${products.subscriptionProducts.starter.price.id}
STRIPE_GROWTH_PRICE_ID=${products.subscriptionProducts.growth.price.id}
STRIPE_SCALE_PRICE_ID=${products.subscriptionProducts.scale.price.id}

# Overage Price IDs (for metered billing)
STRIPE_IMAGE_OVERAGE_STARTER_PRICE_ID=${products.overageProducts.image.prices.starter.id}
STRIPE_IMAGE_OVERAGE_GROWTH_PRICE_ID=${products.overageProducts.image.prices.growth.id}
STRIPE_IMAGE_OVERAGE_SCALE_PRICE_ID=${products.overageProducts.image.prices.scale.id}

STRIPE_TEXT_OVERAGE_STARTER_PRICE_ID=${products.overageProducts.text.prices.starter.id}
STRIPE_TEXT_OVERAGE_GROWTH_PRICE_ID=${products.overageProducts.text.prices.growth.id}
STRIPE_TEXT_OVERAGE_SCALE_PRICE_ID=${products.overageProducts.text.prices.scale.id}
`);
  
  console.log('\n🎉 Setup complete! Your Stripe account is now configured.');
  console.log('   Visit https://dashboard.stripe.com/products to view your products.\n');
}

async function main() {
  console.log('\n🚀 Content Shop - Stripe Product Setup');
  console.log('='.repeat(60));
  
  try {
    // Verify connection
    console.log('\n🔐 Verifying Stripe connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`   ✓ Connected to Stripe account: ${account.settings?.dashboard?.display_name || account.id}`);
    
    // Check for existing meters (we can reuse these)
    const existingMeters = await checkExistingMeters();
    
    // Check for existing products
    const hasExisting = await checkExistingProducts();
    if (hasExisting) {
      console.log('\n⚠️  Products already exist. To recreate, first archive them in the Stripe dashboard.');
      console.log('   Continuing will create duplicate products.\n');
      
      // Wait for user confirmation via command line arg
      if (!process.argv.includes('--force')) {
        console.log('   Run with --force flag to create anyway.');
        process.exit(0);
      }
      console.log('   --force flag detected, proceeding...\n');
    }
    
    // Create meters first (required for metered prices)
    const meters = await createBillingMeters(existingMeters);
    
    // Create products
    const subscriptionProducts = await createSubscriptionProducts();
    const overageProducts = await createOverageProducts(meters);
    
    // Print summary
    printSummary({
      subscriptionProducts,
      meters,
      overageProducts,
    });
    
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error('\n❌ Stripe API Error:', error.message);
      console.error('   Type:', error.type);
      if (error.code) console.error('   Code:', error.code);
    } else {
      console.error('\n❌ Error:', error);
    }
    process.exit(1);
  }
}

main();
