/**
 * Cleanup old Stripe Portal configurations
 * 
 * Run with: npx tsx scripts/cleanup-portal-configs.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from multiple possible locations
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
  console.error('   Make sure .env.local or .env contains STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-04-30.basil',
});

async function cleanupPortalConfigs() {
  console.log('🔍 Fetching portal configurations...\n');

  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  
  console.log(`Found ${configs.data.length} portal configuration(s)\n`);

  for (const config of configs.data) {
    console.log(`📋 Configuration: ${config.id}`);
    console.log(`   Active: ${config.active}`);
    console.log(`   Default: ${config.is_default}`);
    console.log(`   Created: ${new Date(config.created * 1000).toISOString()}`);
    
    if (config.features.subscription_update) {
      console.log(`   Proration behavior: ${config.features.subscription_update.proration_behavior}`);
    }
    
    // Deactivate non-default configurations
    if (!config.is_default && config.active) {
      console.log(`   ⚠️  Deactivating this configuration...`);
      try {
        await stripe.billingPortal.configurations.update(config.id, {
          active: false,
        });
        console.log(`   ✓ Deactivated`);
      } catch (error: any) {
        console.log(`   ✗ Could not deactivate: ${error.message}`);
      }
    }
    
    console.log('');
  }

  console.log('\n✅ Cleanup complete!');
  console.log('\nNote: The next time a user accesses the portal, a fresh configuration will be created.');
}

cleanupPortalConfigs().catch(console.error);

