/**
 * Stripe Products Archive Script
 * 
 * Archives all Content Shop related products in your Stripe account.
 * This is useful for cleanup before re-running setup.
 * 
 * Run with: npx tsx scripts/archive-stripe-products.ts
 * 
 * WARNING: This will archive products. Archived products cannot be used
 * for new subscriptions but existing subscriptions will continue to work.
 * 
 * Note: Meters cannot be deleted via API but will be listed for reference.
 */

import Stripe from 'stripe';
import { config } from 'dotenv';
import * as readline from 'readline';

config({ path: '.env.local' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('\n🗑️  Content Shop - Archive Stripe Products\n');
  console.log('='.repeat(60));
  console.log('\n⚠️  WARNING: This will archive all Content Shop products.');
  console.log('   Existing subscriptions will continue to work.');
  console.log('   You can unarchive products in the Stripe dashboard.');
  console.log('   Note: Meters cannot be deleted but can be deactivated manually.\n');

  try {
    // List meters
    const meters = await stripe.billing.meters.list({ limit: 100 });
    const contentShopMeters = meters.data.filter(m => 
      m.event_name.includes('content_shop')
    );

    if (contentShopMeters.length > 0) {
      console.log('📊 Found Content Shop meters (cannot be deleted via API):');
      for (const meter of contentShopMeters) {
        console.log(`   - ${meter.display_name} (${meter.id}) - status: ${meter.status}`);
      }
      console.log('   To deactivate meters, visit: https://dashboard.stripe.com/billing/meters\n');
    }

    // List all products
    const products = await stripe.products.list({ 
      limit: 100,
      active: true,
    });

    // Filter Content Shop products
    const contentShopProducts = products.data.filter(p => 
      p.metadata?.tier || 
      p.metadata?.type?.includes('overage') ||
      p.name.toLowerCase().includes('content shop') ||
      p.name.toLowerCase().includes('generation overage')
    );

    if (contentShopProducts.length === 0) {
      console.log('   No Content Shop products found to archive.\n');
      return;
    }

    console.log(`Found ${contentShopProducts.length} Content Shop products to archive:\n`);
    
    for (const product of contentShopProducts) {
      console.log(`   - ${product.name} (${product.id})`);
    }

    console.log('');

    // Skip confirmation if --yes flag is passed
    if (!process.argv.includes('--yes')) {
      const confirmed = await confirm('Proceed with archiving products?');
      if (!confirmed) {
        console.log('\n   Cancelled.\n');
        return;
      }
    }

    console.log('\n📦 Archiving products...\n');

    for (const product of contentShopProducts) {
      // Get all prices for this product first
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      // Archive the product first (this works even with default price set)
      await stripe.products.update(product.id, { active: false });
      console.log(`   ✓ Archived product: ${product.name} (${product.id})`);

      // Then archive all prices (including the former default price)
      for (const price of prices.data) {
        try {
          await stripe.prices.update(price.id, { active: false });
          console.log(`   ✓ Archived price: ${price.id}`);
        } catch (err) {
          // Some prices may fail to archive, log and continue
          console.log(`   ⚠ Could not archive price: ${price.id} (may already be inactive)`);
        }
      }
      console.log('');
    }

    console.log('✅ All Content Shop products have been archived.');
    console.log('   Run `pnpm stripe:setup` to create new products.');
    
    if (contentShopMeters.length > 0) {
      console.log('\n⚠️  Note: Meters are still active. The setup script will reuse them.');
      console.log('   To start fresh with meters, deactivate them in the dashboard first.\n');
    }

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

