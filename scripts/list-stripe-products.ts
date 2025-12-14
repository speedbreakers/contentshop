/**
 * Stripe Products Listing Script
 * 
 * Lists all Content Shop related products, meters, and prices in your Stripe account.
 * Run with: npx tsx scripts/list-stripe-products.ts
 */

import Stripe from 'stripe';
import { config } from 'dotenv';

config({ path: '.env.local' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

async function main() {
  console.log('\n📋 Content Shop - Stripe Configuration\n');
  console.log('='.repeat(60));

  try {
    // List meters first
    console.log('\n📊 BILLING METERS:');
    console.log('-'.repeat(60));
    
    const meters = await stripe.billing.meters.list({ limit: 100 });
    const contentShopMeters = meters.data.filter(m => 
      m.event_name.includes('content_shop')
    );

    if (contentShopMeters.length === 0) {
      console.log('\n   No Content Shop meters found.');
    } else {
      for (const meter of contentShopMeters) {
        console.log(`\n   ${meter.display_name}`);
        console.log(`   ID: ${meter.id}`);
        console.log(`   Event Name: ${meter.event_name}`);
        console.log(`   Status: ${meter.status}`);
        console.log(`   Aggregation: ${meter.default_aggregation.formula}`);
      }
    }

    // List all products
    const products = await stripe.products.list({ 
      limit: 100,
      expand: ['data.default_price'],
    });

    // Filter Content Shop products
    const contentShopProducts = products.data.filter(p => 
      p.metadata?.tier || 
      p.metadata?.type?.includes('overage') ||
      p.name.toLowerCase().includes('content shop') ||
      p.name.toLowerCase().includes('generation overage')
    );

    if (contentShopProducts.length === 0) {
      console.log('\n\n   No Content Shop products found.');
      console.log('   Run `pnpm stripe:setup` to create them.\n');
      return;
    }

    // Group by type
    const subscriptionProducts = contentShopProducts.filter(p => p.metadata?.tier);
    const overageProducts = contentShopProducts.filter(p => 
      p.metadata?.type?.includes('overage') || 
      p.name.toLowerCase().includes('overage')
    );

    if (subscriptionProducts.length > 0) {
      console.log('\n\n📦 SUBSCRIPTION PRODUCTS:');
      console.log('-'.repeat(60));
      
      for (const product of subscriptionProducts) {
        const defaultPrice = product.default_price as Stripe.Price | null;
        console.log(`\n   ${product.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Active: ${product.active ? '✓' : '✗'}`);
        console.log(`   Tier: ${product.metadata?.tier}`);
        console.log(`   Credits: ${product.metadata?.image_credits} images, ${product.metadata?.text_credits} text`);
        if (defaultPrice) {
          console.log(`   Default Price: ${defaultPrice.id}`);
          console.log(`   Amount: $${(defaultPrice.unit_amount ?? 0) / 100}/month`);
        }
      }
    }

    if (overageProducts.length > 0) {
      console.log('\n\n📊 OVERAGE PRODUCTS (Metered):');
      console.log('-'.repeat(60));
      
      for (const product of overageProducts) {
        console.log(`\n   ${product.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   Active: ${product.active ? '✓' : '✗'}`);
        console.log(`   Type: ${product.metadata?.type || 'overage'}`);

        // List prices for this product
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        });

        if (prices.data.length > 0) {
          console.log('   Prices:');
          for (const price of prices.data) {
            const tier = price.metadata?.tier || price.nickname || 'unknown';
            const meterId = price.recurring?.meter;
            console.log(`     - ${tier}: ${price.id} ($${(price.unit_amount ?? 0) / 100}/unit)`);
            if (meterId) {
              console.log(`       Meter: ${meterId}`);
            }
          }
        }
      }
    }

    console.log('\n');

  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error('❌ Stripe API Error:', error.message);
    } else {
      console.error('❌ Error:', error);
    }
    process.exit(1);
  }
}

main();

