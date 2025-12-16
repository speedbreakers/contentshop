-- Commerce Accounts (connected storefronts)
CREATE TABLE IF NOT EXISTS "commerce_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "provider" varchar(20) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'connected',
  "shop_domain" varchar(255),
  "access_token" text,
  "scopes" text,
  "installed_at" timestamp,
  "app_uninstalled_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "commerce_accounts_team_id_idx" ON "commerce_accounts" ("team_id");
CREATE INDEX IF NOT EXISTS "commerce_accounts_team_provider_idx" ON "commerce_accounts" ("team_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_accounts_shop_domain_unique" ON "commerce_accounts" ("shop_domain");

-- External Products (mirror from external stores)
CREATE TABLE IF NOT EXISTS "external_products" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "external_product_id" text NOT NULL,
  "title" varchar(255),
  "handle" varchar(255),
  "status" varchar(20),
  "product_type" varchar(255),
  "vendor" varchar(255),
  "tags" text,
  "featured_image_url" text,
  "raw" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "external_products_team_id_idx" ON "external_products" ("team_id");
CREATE INDEX IF NOT EXISTS "external_products_account_id_idx" ON "external_products" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "external_products_account_external_unique" ON "external_products" ("account_id", "external_product_id");

-- External Variants (mirror from external stores)
CREATE TABLE IF NOT EXISTS "external_variants" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "external_product_id" text NOT NULL,
  "external_variant_id" text NOT NULL,
  "title" varchar(255),
  "sku" varchar(120),
  "price" varchar(50),
  "selected_options" jsonb,
  "featured_image_url" text,
  "uploaded_file_id" integer REFERENCES "uploaded_files"("id"),
  "raw" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "external_variants_team_id_idx" ON "external_variants" ("team_id");
CREATE INDEX IF NOT EXISTS "external_variants_account_id_idx" ON "external_variants" ("account_id");
CREATE INDEX IF NOT EXISTS "external_variants_external_product_idx" ON "external_variants" ("account_id", "external_product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "external_variants_account_variant_unique" ON "external_variants" ("account_id", "external_variant_id");

-- Product Links (canonical ↔ external)
CREATE TABLE IF NOT EXISTS "product_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "product_id" integer NOT NULL REFERENCES "products"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "external_product_id" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'linked',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "product_links_team_id_idx" ON "product_links" ("team_id");
CREATE INDEX IF NOT EXISTS "product_links_product_id_idx" ON "product_links" ("product_id");
CREATE INDEX IF NOT EXISTS "product_links_account_id_idx" ON "product_links" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_links_account_external_unique" ON "product_links" ("account_id", "external_product_id");

-- Variant Links (canonical ↔ external)
CREATE TABLE IF NOT EXISTS "variant_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "variant_id" integer NOT NULL REFERENCES "product_variants"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "external_product_id" text NOT NULL,
  "external_variant_id" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'linked',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "variant_links_team_id_idx" ON "variant_links" ("team_id");
CREATE INDEX IF NOT EXISTS "variant_links_variant_id_idx" ON "variant_links" ("variant_id");
CREATE INDEX IF NOT EXISTS "variant_links_account_id_idx" ON "variant_links" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "variant_links_account_variant_unique" ON "variant_links" ("account_id", "external_variant_id");

-- Asset Publications (publish history)
CREATE TABLE IF NOT EXISTS "asset_publications" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "product_id" integer REFERENCES "products"("id"),
  "variant_id" integer REFERENCES "product_variants"("id"),
  "variant_image_id" integer NOT NULL REFERENCES "variant_images"("id"),
  "external_product_id" text NOT NULL,
  "external_variant_id" text NOT NULL,
  "remote_media_id" text,
  "remote_resource_version" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "error" text,
  "attempts" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "asset_publications_team_id_idx" ON "asset_publications" ("team_id");
CREATE INDEX IF NOT EXISTS "asset_publications_account_id_idx" ON "asset_publications" ("account_id");
CREATE INDEX IF NOT EXISTS "asset_publications_variant_image_idx" ON "asset_publications" ("variant_image_id");
CREATE INDEX IF NOT EXISTS "asset_publications_status_idx" ON "asset_publications" ("status");

-- Commerce Jobs (background job queue)
CREATE TABLE IF NOT EXISTS "commerce_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "account_id" integer NOT NULL REFERENCES "commerce_accounts"("id"),
  "provider" varchar(20) NOT NULL,
  "type" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "progress" jsonb,
  "error" text,
  "metadata" jsonb,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "commerce_jobs_team_id_idx" ON "commerce_jobs" ("team_id");
CREATE INDEX IF NOT EXISTS "commerce_jobs_account_id_idx" ON "commerce_jobs" ("account_id");
CREATE INDEX IF NOT EXISTS "commerce_jobs_status_idx" ON "commerce_jobs" ("status");
CREATE INDEX IF NOT EXISTS "commerce_jobs_type_status_idx" ON "commerce_jobs" ("type", "status");

