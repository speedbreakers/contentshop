import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  // Credit system fields
  planTier: varchar('plan_tier', { length: 20 }), // starter|growth|scale
  overageEnabled: boolean('overage_enabled').default(true),
  overageLimitCents: integer('overage_limit_cents'),
  stripeImageMeterId: text('stripe_image_meter_id'),
  stripeTextMeterId: text('stripe_text_meter_id'),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

/**
 * Uploaded files (team-owned)
 * - Source of truth for "previously uploaded files" in asset pickers.
 * - Stores Vercel Blob info (public blobUrl + pathname), but clients should use signed app URLs.
 */
export const uploadedFiles = pgTable(
  'uploaded_files',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    kind: varchar('kind', { length: 30 }).notNull(), // garment|product|model|background|moodboard

    // Vercel Blob result fields
    pathname: text('pathname').notNull(),
    blobUrl: text('blob_url').notNull(),

    originalName: varchar('original_name', { length: 255 }),
    contentType: varchar('content_type', { length: 100 }),
    size: integer('size'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('uploaded_files_team_id_idx').on(t.teamId),
    teamKindIdx: index('uploaded_files_team_kind_idx').on(t.teamId, t.kind),
  })
);

/**
 * Moodboards (team-owned)
 * - A selectable style + reference set applied per-generation.
 * - Future: can optionally belong to a Brand for inheritance, without renaming.
 */
export const moodboards = pgTable(
  'moodboards',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    styleProfile: jsonb('style_profile').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    teamIdx: index('moodboards_team_id_idx').on(t.teamId),
    teamDeletedIdx: index('moodboards_team_deleted_at_idx').on(t.teamId, t.deletedAt),
  })
);

/**
 * Moodboard assets: references to uploaded_files (moodboard reference images).
 */
export const moodboardAssets = pgTable(
  'moodboard_assets',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    moodboardId: integer('moodboard_id')
      .notNull()
      .references(() => moodboards.id),
    uploadedFileId: integer('uploaded_file_id')
      .notNull()
      .references(() => uploadedFiles.id),

    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('moodboard_assets_team_id_idx').on(t.teamId),
    moodboardIdx: index('moodboard_assets_moodboard_id_idx').on(t.moodboardId),
    uniqueMoodboardFile: uniqueIndex('moodboard_assets_moodboard_file_unique').on(
      t.moodboardId,
      t.uploadedFileId
    ),
  })
);

/**
 * Products & Variants (team-owned)
 * - All generated assets are variant-scoped; product-level content uses default variant.
 */

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    // Category drives generation schema/UI. Stored on product only (variants do not override).
    category: varchar('category', { length: 30 }).notNull().default('apparel'),
    vendor: varchar('vendor', { length: 255 }),
    productType: varchar('product_type', { length: 255 }),
    handle: varchar('handle', { length: 255 }),
    tags: text('tags'),
    imageUrl: text('image_url'),

    // Manual Shopify linking (future: include store connection)
    shopifyProductGid: text('shopify_product_gid'),

    // Single source of truth for default variant.
    // Note: left nullable to avoid circular insert issues; enforce in app transaction.
    defaultVariantId: integer('default_variant_id'),

    // Selected product description (from productDescriptions table)
    selectedDescriptionId: integer('selected_description_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    teamIdx: index('products_team_id_idx').on(t.teamId),
    teamHandleUnique: uniqueIndex('products_team_handle_unique').on(
      t.teamId,
      t.handle
    ),
  })
);

export const productOptions = pgTable(
  'product_options',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),

    name: varchar('name', { length: 100 }).notNull(),
    position: integer('position').notNull(), // 1..3 (enforce in app)

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index('product_options_product_id_idx').on(t.productId),
    uniqueNamePerProduct: uniqueIndex(
      'product_options_product_name_unique'
    ).on(t.productId, t.name),
    uniquePositionPerProduct: uniqueIndex(
      'product_options_product_position_unique'
    ).on(t.productId, t.position),
  })
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),

    title: varchar('title', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 120 }),
    imageUrl: text('image_url'),

    // Manual Shopify linking
    shopifyVariantGid: text('shopify_variant_gid'),

    // Optional: selection pointers for later (generation/sync)
    selectedDescriptionTextId: integer('selected_description_text_id'),
    selectedShortCopyTextId: integer('selected_short_copy_text_id'),
    selectedHighlightsTextId: integer('selected_highlights_text_id'),
    selectedPrimaryImageId: integer('selected_primary_image_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    productIdx: index('product_variants_product_id_idx').on(t.productId),
    teamIdx: index('product_variants_team_id_idx').on(t.teamId),
    skuPerProductUnique: uniqueIndex('product_variants_product_sku_unique').on(
      t.productId,
      t.sku
    ),
  })
);

export const variantOptionValues = pgTable(
  'variant_option_values',
  {
    id: serial('id').primaryKey(),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    productOptionId: integer('product_option_id')
      .notNull()
      .references(() => productOptions.id),
    value: varchar('value', { length: 255 }).notNull(),
  },
  (t) => ({
    variantIdx: index('variant_option_values_variant_id_idx').on(t.variantId),
    uniquePerVariantOption: uniqueIndex(
      'variant_option_values_variant_option_unique'
    ).on(t.variantId, t.productOptionId),
  })
);

/**
 * Variant Generations + Images
 * - A generation represents one request with structured inputs.
 * - It produces N output images (number_of_variations).
 * - Output images are stored in variant_images and can be added to folders via set_items.
 */

export const variantGenerations = pgTable(
  'variant_generations',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),

    schemaKey: varchar('schema_key', { length: 50 }).notNull(), // e.g. apparel.v1
    input: jsonb('input').notNull(),
    numberOfVariations: integer('number_of_variations').notNull().default(1),
    moodboardId: integer('moodboard_id').references(() => moodboards.id),

    provider: varchar('provider', { length: 30 }).notNull().default('mock'),
    status: varchar('status', { length: 20 }).notNull().default('generating'), // generating|ready|failed
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('variant_generations_team_id_idx').on(t.teamId),
    variantIdx: index('variant_generations_variant_id_idx').on(t.variantId),
    statusIdx: index('variant_generations_status_idx').on(t.status),
    moodboardIdx: index('variant_generations_moodboard_id_idx').on(t.moodboardId),
  })
);

export const variantImages = pgTable(
  'variant_images',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),

    generationId: integer('generation_id').references(() => variantGenerations.id),

    status: varchar('status', { length: 20 }).notNull().default('ready'), // generating|ready|failed
    url: text('url').notNull(),
    prompt: text('prompt'),
    schemaKey: varchar('schema_key', { length: 50 }),
    input: jsonb('input'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('variant_images_team_id_idx').on(t.teamId),
    variantIdx: index('variant_images_variant_id_idx').on(t.variantId),
    generationIdx: index('variant_images_generation_id_idx').on(t.generationId),
  })
);

/**
 * Sets (internal grouping for generations)
 * - A Set is an internal, user-managed grouping for organizing lots of generated outputs.
 * - This is NOT Shopify Collections and is NOT (necessarily) marketing campaigns.
 */

export const sets = pgTable(
  'sets',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    // Scope: variant today; keep flexible for future (e.g. product via default variant).
    scopeType: varchar('scope_type', { length: 20 }).notNull().default('variant'),
    productId: integer('product_id').references(() => products.id),
    variantId: integer('variant_id').references(() => productVariants.id),

    // A single, backend-generated default set per variant.
    // All generations go here unless the user moves them to another set.
    isDefault: boolean('is_default').notNull().default(false),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    createdByUserId: integer('created_by_user_id').references(() => users.id),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    teamIdx: index('sets_team_id_idx').on(t.teamId),
    teamVariantIdx: index('sets_team_variant_id_idx').on(t.teamId, t.variantId),
    teamVariantDefaultIdx: index('sets_team_variant_default_idx').on(
      t.teamId,
      t.variantId,
      t.isDefault
    ),
    teamDeletedIdx: index('sets_team_deleted_at_idx').on(t.teamId, t.deletedAt),
  })
);

export const setItems = pgTable(
  'set_items',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    setId: integer('set_id')
      .notNull()
      .references(() => sets.id),

    // Polymorphic ref: variant_image | variant_text (future). For now itemId is an integer.
    itemType: varchar('item_type', { length: 30 }).notNull(),
    itemId: integer('item_id').notNull(),

    sortOrder: integer('sort_order').notNull().default(0),
    addedByUserId: integer('added_by_user_id').references(() => users.id),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    setIdx: index('set_items_set_id_idx').on(t.setId),
    teamItemIdx: index('set_items_team_item_idx').on(t.teamId, t.itemType, t.itemId),
    uniqueItemInSet: uniqueIndex('set_items_unique_item_in_set').on(
      t.setId,
      t.itemType,
      t.itemId
    ),
  })
);

export const setEvents = pgTable(
  'set_events',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    setId: integer('set_id')
      .notNull()
      .references(() => sets.id),
    actorUserId: integer('actor_user_id').references(() => users.id),

    type: varchar('type', { length: 30 }).notNull(),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    setIdx: index('set_events_set_id_idx').on(t.setId),
    teamIdx: index('set_events_team_id_idx').on(t.teamId),
  })
);

/**
 * Product Descriptions (product-level text generations)
 * - Stores generated description versions for products.
 * - Products can have multiple descriptions; one is selected as the current.
 */
export const productDescriptions = pgTable(
  'product_descriptions',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),

    status: varchar('status', { length: 20 }).notNull().default('generating'), // generating|ready|failed
    prompt: text('prompt').notNull(),
    tone: varchar('tone', { length: 20 }), // premium|playful|minimal
    length: varchar('length', { length: 20 }), // short|medium|long
    content: text('content'),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('product_descriptions_team_id_idx').on(t.teamId),
    productIdx: index('product_descriptions_product_id_idx').on(t.productId),
    statusIdx: index('product_descriptions_status_idx').on(t.status),
  })
);

/**
 * Team Credits (credit allocations per billing period)
 * - Tracks included credits and usage for each billing period.
 * - Overage usage is tracked separately for metered billing.
 */
export const teamCredits = pgTable(
  'team_credits',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),

    // Included credits from subscription tier
    imageCreditsIncluded: integer('image_credits_included').notNull().default(0),
    textCreditsIncluded: integer('text_credits_included').notNull().default(0),

    // Usage counters
    imageCreditsUsed: integer('image_credits_used').notNull().default(0),
    textCreditsUsed: integer('text_credits_used').notNull().default(0),

    // Overage usage (beyond included)
    imageOverageUsed: integer('image_overage_used').notNull().default(0),
    textOverageUsed: integer('text_overage_used').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('team_credits_team_idx').on(t.teamId),
    periodIdx: index('team_credits_period_idx').on(t.teamId, t.periodStart),
  })
);

/**
 * Usage Records (audit trail for credit usage)
 * - Tracks individual generation events for billing and analytics.
 */
export const usageRecords = pgTable(
  'usage_records',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    userId: integer('user_id').references(() => users.id),
    teamCreditsId: integer('team_credits_id').references(() => teamCredits.id),

    usageType: varchar('usage_type', { length: 20 }).notNull(), // 'image' | 'text'
    referenceType: varchar('reference_type', { length: 30 }), // 'variant_generation' | 'product_description'
    referenceId: integer('reference_id'),

    creditsUsed: integer('credits_used').notNull().default(1),
    isOverage: boolean('is_overage').notNull().default(false),
    stripeUsageRecordId: text('stripe_usage_record_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('usage_records_team_idx').on(t.teamId),
    creditsIdx: index('usage_records_credits_idx').on(t.teamCreditsId),
  })
);

// ============================================================================
// Commerce Integration Tables
// ============================================================================

/**
 * Commerce Accounts (connected storefronts)
 * - One row per connected storefront account per team.
 * - Supports multiple providers: Shopify, Amazon, Meesho (future).
 */
export const commerceAccounts = pgTable(
  'commerce_accounts',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),

    provider: varchar('provider', { length: 20 }).notNull(), // shopify|amazon|meesho
    displayName: varchar('display_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('connected'), // connected|disconnected

    // Shopify-specific fields (nullable for other providers)
    shopDomain: varchar('shop_domain', { length: 255 }), // e.g. mybrand.myshopify.com
    accessToken: text('access_token'), // encrypted at rest
    scopes: text('scopes'),
    installedAt: timestamp('installed_at'),
    appUninstalledAt: timestamp('app_uninstalled_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    teamIdx: index('commerce_accounts_team_id_idx').on(t.teamId),
    teamProviderIdx: index('commerce_accounts_team_provider_idx').on(t.teamId, t.provider),
    shopDomainUnique: uniqueIndex('commerce_accounts_shop_domain_unique').on(t.shopDomain),
  })
);

/**
 * External Products (mirror of products from external stores)
 * - Lightweight mirror for linking UI (not full replication).
 * - External products are per-account.
 */
export const externalProducts = pgTable(
  'external_products',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(), // denormalized for queries
    externalProductId: text('external_product_id').notNull(), // Shopify GID string

    title: varchar('title', { length: 255 }),
    handle: varchar('handle', { length: 255 }),
    status: varchar('status', { length: 20 }), // active|draft|archived
    productType: varchar('product_type', { length: 255 }),
    vendor: varchar('vendor', { length: 255 }),
    tags: text('tags'),
    featuredImageUrl: text('featured_image_url'),
    raw: jsonb('raw'), // optional: minimal snapshot

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('external_products_team_id_idx').on(t.teamId),
    accountIdx: index('external_products_account_id_idx').on(t.accountId),
    accountExternalUnique: uniqueIndex('external_products_account_external_unique').on(
      t.accountId,
      t.externalProductId
    ),
  })
);

/**
 * External Variants (mirror of variants from external stores)
 * - Lightweight mirror for linking UI.
 * - Supports image ingestion via uploaded_file_id.
 */
export const externalVariants = pgTable(
  'external_variants',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(), // denormalized
    externalProductId: text('external_product_id').notNull(), // parent product GID
    externalVariantId: text('external_variant_id').notNull(), // Shopify variant GID

    title: varchar('title', { length: 255 }),
    sku: varchar('sku', { length: 120 }),
    price: varchar('price', { length: 50 }),
    selectedOptions: jsonb('selected_options'), // [{name, value}, ...]
    featuredImageUrl: text('featured_image_url'), // Original Shopify CDN URL
    uploadedFileId: integer('uploaded_file_id').references(() => uploadedFiles.id), // Ingested copy
    raw: jsonb('raw'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('external_variants_team_id_idx').on(t.teamId),
    accountIdx: index('external_variants_account_id_idx').on(t.accountId),
    externalProductIdx: index('external_variants_external_product_idx').on(
      t.accountId,
      t.externalProductId
    ),
    accountVariantUnique: uniqueIndex('external_variants_account_variant_unique').on(
      t.accountId,
      t.externalVariantId
    ),
  })
);

/**
 * Product Links (canonical product ↔ external product)
 * - Links ContentShop canonical products to external store products.
 * - Constraint: one external product can link to only one canonical.
 */
export const productLinks = pgTable(
  'product_links',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(),
    externalProductId: text('external_product_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('linked'), // linked|broken|unlinked

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('product_links_team_id_idx').on(t.teamId),
    productIdx: index('product_links_product_id_idx').on(t.productId),
    accountIdx: index('product_links_account_id_idx').on(t.accountId),
    // External product can link to only one canonical product
    accountExternalUnique: uniqueIndex('product_links_account_external_unique').on(
      t.accountId,
      t.externalProductId
    ),
  })
);

/**
 * Variant Links (canonical variant ↔ external variant)
 * - Links ContentShop canonical variants to external store variants.
 * - Constraint: one external variant can link to only one canonical.
 */
export const variantLinks = pgTable(
  'variant_links',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(),
    externalProductId: text('external_product_id').notNull(),
    externalVariantId: text('external_variant_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('linked'), // linked|broken|unlinked

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('variant_links_team_id_idx').on(t.teamId),
    variantIdx: index('variant_links_variant_id_idx').on(t.variantId),
    accountIdx: index('variant_links_account_id_idx').on(t.accountId),
    // External variant can link to only one canonical variant
    accountVariantUnique: uniqueIndex('variant_links_account_variant_unique').on(
      t.accountId,
      t.externalVariantId
    ),
  })
);

/**
 * Asset Publications (publish history)
 * - Tracks each publish attempt of a generated image to an external variant.
 * - Stores remote media ID on success for reference.
 */
export const assetPublications = pgTable(
  'asset_publications',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(),
    productId: integer('product_id').references(() => products.id), // canonical
    variantId: integer('variant_id').references(() => productVariants.id), // canonical
    variantImageId: integer('variant_image_id')
      .notNull()
      .references(() => variantImages.id),

    externalProductId: text('external_product_id').notNull(),
    externalVariantId: text('external_variant_id').notNull(),

    remoteMediaId: text('remote_media_id'), // Shopify media GID on success
    remoteResourceVersion: text('remote_resource_version'),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending|success|failed
    error: text('error'),
    attempts: integer('attempts').notNull().default(1),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('asset_publications_team_id_idx').on(t.teamId),
    accountIdx: index('asset_publications_account_id_idx').on(t.accountId),
    variantImageIdx: index('asset_publications_variant_image_idx').on(t.variantImageId),
    statusIdx: index('asset_publications_status_idx').on(t.status),
  })
);

/**
 * Commerce Jobs (background job queue)
 * - Tracks sync, publish, and other commerce operations.
 * - Progress stored as jsonb for chunked operations.
 */
export const commerceJobs = pgTable(
  'commerce_jobs',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => commerceAccounts.id),

    provider: varchar('provider', { length: 20 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // shopify.catalog_sync|shopify.publish_variant_media
    status: varchar('status', { length: 20 }).notNull().default('queued'), // queued|running|success|failed|canceled

    progress: jsonb('progress'), // { cursor, processed, total }
    error: text('error'),
    metadata: jsonb('metadata'), // job-specific data

    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    teamIdx: index('commerce_jobs_team_id_idx').on(t.teamId),
    accountIdx: index('commerce_jobs_account_id_idx').on(t.accountId),
    statusIdx: index('commerce_jobs_status_idx').on(t.status),
    typeStatusIdx: index('commerce_jobs_type_status_idx').on(t.type, t.status),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  products: many(products),
  uploadedFiles: many(uploadedFiles),
  moodboards: many(moodboards),
  sets: many(sets),
  teamCredits: many(teamCredits),
  usageRecords: many(usageRecords),
  commerceAccounts: many(commerceAccounts),
  externalProducts: many(externalProducts),
  externalVariants: many(externalVariants),
  productLinks: many(productLinks),
  variantLinks: many(variantLinks),
  assetPublications: many(assetPublications),
  commerceJobs: many(commerceJobs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  team: one(teams, {
    fields: [uploadedFiles.teamId],
    references: [teams.id],
  }),
}));

export const moodboardsRelations = relations(moodboards, ({ one, many }) => ({
  team: one(teams, {
    fields: [moodboards.teamId],
    references: [teams.id],
  }),
  assets: many(moodboardAssets),
}));

export const moodboardAssetsRelations = relations(moodboardAssets, ({ one }) => ({
  team: one(teams, {
    fields: [moodboardAssets.teamId],
    references: [teams.id],
  }),
  moodboard: one(moodboards, {
    fields: [moodboardAssets.moodboardId],
    references: [moodboards.id],
  }),
  uploadedFile: one(uploadedFiles, {
    fields: [moodboardAssets.uploadedFileId],
    references: [uploadedFiles.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  team: one(teams, {
    fields: [products.teamId],
    references: [teams.id],
  }),
  variants: many(productVariants),
  options: many(productOptions),
  sets: many(sets),
  descriptions: many(productDescriptions),
}));

export const productDescriptionsRelations = relations(productDescriptions, ({ one }) => ({
  team: one(teams, {
    fields: [productDescriptions.teamId],
    references: [teams.id],
  }),
  product: one(products, {
    fields: [productDescriptions.productId],
    references: [products.id],
  }),
}));

export const teamCreditsRelations = relations(teamCredits, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamCredits.teamId],
    references: [teams.id],
  }),
  usageRecords: many(usageRecords),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  team: one(teams, {
    fields: [usageRecords.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  teamCredit: one(teamCredits, {
    fields: [usageRecords.teamCreditsId],
    references: [teamCredits.id],
  }),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [productVariants.teamId],
      references: [teams.id],
    }),
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    optionValues: many(variantOptionValues),
    sets: many(sets),
  })
);

export const productOptionsRelations = relations(productOptions, ({ one, many }) => ({
  team: one(teams, {
    fields: [productOptions.teamId],
    references: [teams.id],
  }),
  product: one(products, {
    fields: [productOptions.productId],
    references: [products.id],
  }),
  variantValues: many(variantOptionValues),
}));

export const variantOptionValuesRelations = relations(
  variantOptionValues,
  ({ one }) => ({
    variant: one(productVariants, {
      fields: [variantOptionValues.variantId],
      references: [productVariants.id],
    }),
    productOption: one(productOptions, {
      fields: [variantOptionValues.productOptionId],
      references: [productOptions.id],
    }),
  })
);

export const variantGenerationsRelations = relations(variantGenerations, ({ one, many }) => ({
  team: one(teams, {
    fields: [variantGenerations.teamId],
    references: [teams.id],
  }),
  variant: one(productVariants, {
    fields: [variantGenerations.variantId],
    references: [productVariants.id],
  }),
  images: many(variantImages),
}));

export const variantImagesRelations = relations(variantImages, ({ one }) => ({
  team: one(teams, {
    fields: [variantImages.teamId],
    references: [teams.id],
  }),
  variant: one(productVariants, {
    fields: [variantImages.variantId],
    references: [productVariants.id],
  }),
  generation: one(variantGenerations, {
    fields: [variantImages.generationId],
    references: [variantGenerations.id],
  }),
}));

export const setsRelations = relations(sets, ({ one, many }) => ({
  team: one(teams, {
    fields: [sets.teamId],
    references: [teams.id],
  }),
  product: one(products, {
    fields: [sets.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [sets.variantId],
    references: [productVariants.id],
  }),
  items: many(setItems),
  events: many(setEvents),
}));

export const setItemsRelations = relations(setItems, ({ one }) => ({
  team: one(teams, {
    fields: [setItems.teamId],
    references: [teams.id],
  }),
  set: one(sets, {
    fields: [setItems.setId],
    references: [sets.id],
  }),
}));

export const setEventsRelations = relations(setEvents, ({ one }) => ({
  team: one(teams, {
    fields: [setEvents.teamId],
    references: [teams.id],
  }),
  set: one(sets, {
    fields: [setEvents.setId],
    references: [sets.id],
  }),
  actor: one(users, {
    fields: [setEvents.actorUserId],
    references: [users.id],
  }),
}));

// Commerce Relations
export const commerceAccountsRelations = relations(commerceAccounts, ({ one, many }) => ({
  team: one(teams, {
    fields: [commerceAccounts.teamId],
    references: [teams.id],
  }),
  externalProducts: many(externalProducts),
  externalVariants: many(externalVariants),
  productLinks: many(productLinks),
  variantLinks: many(variantLinks),
  assetPublications: many(assetPublications),
  jobs: many(commerceJobs),
}));

export const externalProductsRelations = relations(externalProducts, ({ one, many }) => ({
  team: one(teams, {
    fields: [externalProducts.teamId],
    references: [teams.id],
  }),
  account: one(commerceAccounts, {
    fields: [externalProducts.accountId],
    references: [commerceAccounts.id],
  }),
  variants: many(externalVariants),
}));

export const externalVariantsRelations = relations(externalVariants, ({ one }) => ({
  team: one(teams, {
    fields: [externalVariants.teamId],
    references: [teams.id],
  }),
  account: one(commerceAccounts, {
    fields: [externalVariants.accountId],
    references: [commerceAccounts.id],
  }),
  uploadedFile: one(uploadedFiles, {
    fields: [externalVariants.uploadedFileId],
    references: [uploadedFiles.id],
  }),
}));

export const productLinksRelations = relations(productLinks, ({ one }) => ({
  team: one(teams, {
    fields: [productLinks.teamId],
    references: [teams.id],
  }),
  product: one(products, {
    fields: [productLinks.productId],
    references: [products.id],
  }),
  account: one(commerceAccounts, {
    fields: [productLinks.accountId],
    references: [commerceAccounts.id],
  }),
}));

export const variantLinksRelations = relations(variantLinks, ({ one }) => ({
  team: one(teams, {
    fields: [variantLinks.teamId],
    references: [teams.id],
  }),
  variant: one(productVariants, {
    fields: [variantLinks.variantId],
    references: [productVariants.id],
  }),
  account: one(commerceAccounts, {
    fields: [variantLinks.accountId],
    references: [commerceAccounts.id],
  }),
}));

export const assetPublicationsRelations = relations(assetPublications, ({ one }) => ({
  team: one(teams, {
    fields: [assetPublications.teamId],
    references: [teams.id],
  }),
  account: one(commerceAccounts, {
    fields: [assetPublications.accountId],
    references: [commerceAccounts.id],
  }),
  product: one(products, {
    fields: [assetPublications.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [assetPublications.variantId],
    references: [productVariants.id],
  }),
  variantImage: one(variantImages, {
    fields: [assetPublications.variantImageId],
    references: [variantImages.id],
  }),
}));

export const commerceJobsRelations = relations(commerceJobs, ({ one }) => ({
  team: one(teams, {
    fields: [commerceJobs.teamId],
    references: [teams.id],
  }),
  account: one(commerceAccounts, {
    fields: [commerceJobs.accountId],
    references: [commerceAccounts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
export type Moodboard = typeof moodboards.$inferSelect;
export type NewMoodboard = typeof moodboards.$inferInsert;
export type MoodboardAsset = typeof moodboardAssets.$inferSelect;
export type NewMoodboardAsset = typeof moodboardAssets.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ProductOption = typeof productOptions.$inferSelect;
export type NewProductOption = typeof productOptions.$inferInsert;
export type VariantOptionValue = typeof variantOptionValues.$inferSelect;
export type NewVariantOptionValue = typeof variantOptionValues.$inferInsert;
export type VariantGeneration = typeof variantGenerations.$inferSelect;
export type NewVariantGeneration = typeof variantGenerations.$inferInsert;
export type VariantImage = typeof variantImages.$inferSelect;
export type NewVariantImage = typeof variantImages.$inferInsert;
export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
export type SetItem = typeof setItems.$inferSelect;
export type NewSetItem = typeof setItems.$inferInsert;
export type SetEvent = typeof setEvents.$inferSelect;
export type NewSetEvent = typeof setEvents.$inferInsert;
export type ProductDescription = typeof productDescriptions.$inferSelect;
export type NewProductDescription = typeof productDescriptions.$inferInsert;
export type TeamCredits = typeof teamCredits.$inferSelect;
export type NewTeamCredits = typeof teamCredits.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

// Commerce types
export type CommerceAccount = typeof commerceAccounts.$inferSelect;
export type NewCommerceAccount = typeof commerceAccounts.$inferInsert;
export type ExternalProduct = typeof externalProducts.$inferSelect;
export type NewExternalProduct = typeof externalProducts.$inferInsert;
export type ExternalVariant = typeof externalVariants.$inferSelect;
export type NewExternalVariant = typeof externalVariants.$inferInsert;
export type ProductLink = typeof productLinks.$inferSelect;
export type NewProductLink = typeof productLinks.$inferInsert;
export type VariantLink = typeof variantLinks.$inferSelect;
export type NewVariantLink = typeof variantLinks.$inferInsert;
export type AssetPublication = typeof assetPublications.$inferSelect;
export type NewAssetPublication = typeof assetPublications.$inferInsert;
export type CommerceJob = typeof commerceJobs.$inferSelect;
export type NewCommerceJob = typeof commerceJobs.$inferInsert;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
