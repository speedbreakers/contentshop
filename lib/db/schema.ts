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

    kind: varchar('kind', { length: 30 }).notNull(), // garment|product|model|background

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

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  products: many(products),
  uploadedFiles: many(uploadedFiles),
  sets: many(sets),
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
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

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
