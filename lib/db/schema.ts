import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
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
    vendor: varchar('vendor', { length: 255 }),
    productType: varchar('product_type', { length: 255 }),
    handle: varchar('handle', { length: 255 }),
    tags: text('tags'),

    // Manual Shopify linking (future: include store connection)
    shopifyProductGid: text('shopify_product_gid'),

    // Single source of truth for default variant.
    // Note: left nullable to avoid circular insert issues; enforce in app transaction.
    defaultVariantId: integer('default_variant_id'),

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

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  products: many(products),
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

export const productsRelations = relations(products, ({ one, many }) => ({
  team: one(teams, {
    fields: [products.teamId],
    references: [teams.id],
  }),
  variants: many(productVariants),
  options: many(productOptions),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
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
