import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { products, teams, teamMembers, users } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { createProductWithDefaultVariant, createVariant } from './products';
import { and, eq, inArray, isNull } from 'drizzle-orm';

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // $8 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // $12 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function seedSampleCatalog(teamId: number) {
  const existing = await db.query.products.findFirst({
    where: and(
      eq(products.teamId, teamId),
      isNull(products.deletedAt),
      inArray(products.handle, ['classic-cotton-tshirt', 'wireless-earbuds', 'gold-pendant-necklace'])
    ),
    columns: { id: true },
  });
  if (existing) {
    console.log('Sample catalog already exists. Skipping.');
    return;
  }

  console.log('Seeding sample products/variants...');

  const { product: apparel, defaultVariant: apparelDefault } =
    await createProductWithDefaultVariant({
      teamId,
      title: 'Classic Cotton T‑Shirt',
      category: 'apparel',
      vendor: 'ACME',
      productType: 'Apparel',
      handle: 'classic-cotton-tshirt',
      tags: 'tshirt,cotton,basics',
      shopifyProductGid: null,
    });

  await createVariant({
    teamId,
    productId: apparel.id,
    title: 'Blue / M',
    sku: 'TSHIRT-BLU-M',
    shopifyVariantGid: null,
  });
  await createVariant({
    teamId,
    productId: apparel.id,
    title: 'Black / L',
    sku: 'TSHIRT-BLK-L',
    shopifyVariantGid: null,
  });

  const { product: electronics } = await createProductWithDefaultVariant({
    teamId,
    title: 'Wireless Earbuds',
    category: 'electronics',
    vendor: 'PulseAudio',
    productType: 'Electronics',
    handle: 'wireless-earbuds',
    tags: 'audio,earbuds,wireless',
    shopifyProductGid: null,
  });

  await createVariant({
    teamId,
    productId: electronics.id,
    title: 'White',
    sku: 'EARBUDS-WHT',
    shopifyVariantGid: null,
  });

  const { product: jewellery } = await createProductWithDefaultVariant({
    teamId,
    title: 'Gold Pendant Necklace',
    category: 'jewellery',
    vendor: 'Aurora',
    productType: 'Jewellery',
    handle: 'gold-pendant-necklace',
    tags: 'necklace,gold,pendant',
    shopifyProductGid: null,
  });

  await createVariant({
    teamId,
    productId: jewellery.id,
    title: '18 inch',
    sku: 'NECKLACE-18',
    shopifyVariantGid: null,
  });

  console.log('Sample catalog seeded:', {
    apparelProductId: apparel.id,
    apparelDefaultVariantId: apparelDefault.id,
    electronicsProductId: electronics.id,
    jewelleryProductId: jewellery.id,
  });
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const existingUser = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
  });

  const user =
    existingUser ??
    (await db
      .insert(users)
      .values([
        {
          email,
          passwordHash,
          role: 'owner',
        },
      ])
      .returning()
      .then((rows) => rows[0] ?? null));

  if (!user) throw new Error('Failed to ensure seed user');
  console.log(existingUser ? 'Seed user exists.' : 'Initial user created.');

  const existingTeam = await db.query.teams.findFirst({
    where: eq(teams.name, 'Test Team'),
  });

  const team =
    existingTeam ??
    (await db
      .insert(teams)
      .values({ name: 'Test Team' })
      .returning()
      .then((rows) => rows[0] ?? null));

  if (!team) throw new Error('Failed to ensure seed team');

  const existingMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id)),
    columns: { id: true },
  });

  if (!existingMember) {
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: 'owner',
    });
  }

  await seedSampleCatalog(team.id);
  await createStripeProducts();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
