CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "asset_publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"variant_image_id" integer NOT NULL,
	"external_product_id" text NOT NULL,
	"external_variant_id" text NOT NULL,
	"remote_media_id" text,
	"remote_resource_version" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"settings" jsonb,
	"variant_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"folder_id" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'connected' NOT NULL,
	"shop_domain" varchar(255),
	"access_token" text,
	"scopes" text,
	"installed_at" timestamp,
	"app_uninstalled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "commerce_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"progress" jsonb,
	"error" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"account_id" integer NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"external_product_id" text NOT NULL,
	"external_variant_id" text NOT NULL,
	"title" varchar(255),
	"sku" varchar(120),
	"price" varchar(50),
	"selected_options" jsonb,
	"featured_image_url" text,
	"uploaded_file_id" integer,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"generation_id" integer,
	"batch_id" integer,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"progress" jsonb,
	"error" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moodboard_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"moodboard_id" integer NOT NULL,
	"uploaded_file_id" integer NOT NULL,
	"kind" varchar(20) DEFAULT 'reference_positive' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moodboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"style_profile" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_descriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"prompt" text NOT NULL,
	"tone" varchar(20),
	"length" varchar(20),
	"content" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"external_product_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'linked' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"sku" varchar(120),
	"image_url" text,
	"shopify_variant_gid" text,
	"selected_description_text_id" integer,
	"selected_short_copy_text_id" integer,
	"selected_highlights_text_id" integer,
	"selected_primary_image_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"category" varchar(30) DEFAULT 'apparel' NOT NULL,
	"vendor" varchar(255),
	"product_type" varchar(255),
	"handle" varchar(255),
	"tags" text,
	"image_url" text,
	"shopify_product_gid" text,
	"default_variant_id" integer,
	"selected_description_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "set_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"set_id" integer NOT NULL,
	"actor_user_id" integer,
	"type" varchar(30) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"set_id" integer NOT NULL,
	"item_type" varchar(30) NOT NULL,
	"item_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"scope_type" varchar(20) DEFAULT 'variant' NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"batch_id" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"stripe_subscription_id" text,
	"image_credits_included" integer DEFAULT 0 NOT NULL,
	"text_credits_included" integer DEFAULT 0 NOT NULL,
	"image_credits_used" integer DEFAULT 0 NOT NULL,
	"text_credits_used" integer DEFAULT 0 NOT NULL,
	"image_overage_used" integer DEFAULT 0 NOT NULL,
	"text_overage_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	"plan_tier" varchar(20),
	"overage_enabled" boolean DEFAULT true,
	"overage_limit_cents" integer,
	"stripe_image_meter_id" text,
	"stripe_text_meter_id" text,
	CONSTRAINT "teams_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "teams_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"kind" varchar(30) NOT NULL,
	"pathname" text NOT NULL,
	"blob_url" text NOT NULL,
	"original_name" varchar(255),
	"content_type" varchar(100),
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"team_credits_id" integer,
	"usage_type" varchar(20) NOT NULL,
	"reference_type" varchar(30),
	"reference_id" integer,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"is_overage" boolean DEFAULT false NOT NULL,
	"stripe_usage_record_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variant_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"schema_key" varchar(50) NOT NULL,
	"input" jsonb NOT NULL,
	"number_of_variations" integer DEFAULT 1 NOT NULL,
	"moodboard_id" integer,
	"provider" varchar(30) DEFAULT 'mock' NOT NULL,
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"generation_id" integer,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"url" text NOT NULL,
	"prompt" text,
	"schema_key" varchar(50),
	"input" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"external_product_id" text NOT NULL,
	"external_variant_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'linked' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"product_option_id" integer NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_publications" ADD CONSTRAINT "asset_publications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_publications" ADD CONSTRAINT "asset_publications_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_publications" ADD CONSTRAINT "asset_publications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_publications" ADD CONSTRAINT "asset_publications_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_publications" ADD CONSTRAINT "asset_publications_variant_image_id_variant_images_id_fk" FOREIGN KEY ("variant_image_id") REFERENCES "public"."variant_images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_folder_id_sets_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_accounts" ADD CONSTRAINT "commerce_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_jobs" ADD CONSTRAINT "commerce_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_jobs" ADD CONSTRAINT "commerce_jobs_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_products" ADD CONSTRAINT "external_products_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_products" ADD CONSTRAINT "external_products_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_variants" ADD CONSTRAINT "external_variants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_variants" ADD CONSTRAINT "external_variants_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_variants" ADD CONSTRAINT "external_variants_uploaded_file_id_uploaded_files_id_fk" FOREIGN KEY ("uploaded_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_generation_id_variant_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."variant_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_assets" ADD CONSTRAINT "moodboard_assets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_assets" ADD CONSTRAINT "moodboard_assets_moodboard_id_moodboards_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboard_assets" ADD CONSTRAINT "moodboard_assets_uploaded_file_id_uploaded_files_id_fk" FOREIGN KEY ("uploaded_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodboards" ADD CONSTRAINT "moodboards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_descriptions" ADD CONSTRAINT "product_descriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_descriptions" ADD CONSTRAINT "product_descriptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_events" ADD CONSTRAINT "set_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_events" ADD CONSTRAINT "set_events_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_events" ADD CONSTRAINT "set_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_items" ADD CONSTRAINT "set_items_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_items" ADD CONSTRAINT "set_items_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_items" ADD CONSTRAINT "set_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_credits" ADD CONSTRAINT "team_credits_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_team_credits_id_team_credits_id_fk" FOREIGN KEY ("team_credits_id") REFERENCES "public"."team_credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_generations" ADD CONSTRAINT "variant_generations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_generations" ADD CONSTRAINT "variant_generations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_generations" ADD CONSTRAINT "variant_generations_moodboard_id_moodboards_id_fk" FOREIGN KEY ("moodboard_id") REFERENCES "public"."moodboards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_generation_id_variant_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."variant_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_links" ADD CONSTRAINT "variant_links_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_links" ADD CONSTRAINT "variant_links_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_links" ADD CONSTRAINT "variant_links_account_id_commerce_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."commerce_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_product_option_id_product_options_id_fk" FOREIGN KEY ("product_option_id") REFERENCES "public"."product_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_publications_team_id_idx" ON "asset_publications" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "asset_publications_account_id_idx" ON "asset_publications" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "asset_publications_variant_image_idx" ON "asset_publications" USING btree ("variant_image_id");--> statement-breakpoint
CREATE INDEX "asset_publications_status_idx" ON "asset_publications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batches_team_id_idx" ON "batches" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "batches_status_idx" ON "batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batches_team_created_at_idx" ON "batches" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "commerce_accounts_team_id_idx" ON "commerce_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "commerce_accounts_team_provider_idx" ON "commerce_accounts" USING btree ("team_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_accounts_shop_domain_unique" ON "commerce_accounts" USING btree ("shop_domain");--> statement-breakpoint
CREATE INDEX "commerce_jobs_team_id_idx" ON "commerce_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "commerce_jobs_account_id_idx" ON "commerce_jobs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "commerce_jobs_status_idx" ON "commerce_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commerce_jobs_type_status_idx" ON "commerce_jobs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "external_products_team_id_idx" ON "external_products" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "external_products_account_id_idx" ON "external_products" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_products_account_external_unique" ON "external_products" USING btree ("account_id","external_product_id");--> statement-breakpoint
CREATE INDEX "external_variants_team_id_idx" ON "external_variants" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "external_variants_account_id_idx" ON "external_variants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "external_variants_external_product_idx" ON "external_variants" USING btree ("account_id","external_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_variants_account_variant_unique" ON "external_variants" USING btree ("account_id","external_variant_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_team_id_idx" ON "generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_variant_id_idx" ON "generation_jobs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_batch_id_idx" ON "generation_jobs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_type_status_idx" ON "generation_jobs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "moodboard_assets_team_id_idx" ON "moodboard_assets" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "moodboard_assets_moodboard_id_idx" ON "moodboard_assets" USING btree ("moodboard_id");--> statement-breakpoint
CREATE INDEX "moodboard_assets_kind_idx" ON "moodboard_assets" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "moodboard_assets_moodboard_file_kind_unique" ON "moodboard_assets" USING btree ("moodboard_id","uploaded_file_id","kind");--> statement-breakpoint
CREATE INDEX "moodboards_team_id_idx" ON "moodboards" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "moodboards_team_deleted_at_idx" ON "moodboards" USING btree ("team_id","deleted_at");--> statement-breakpoint
CREATE INDEX "product_descriptions_team_id_idx" ON "product_descriptions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "product_descriptions_product_id_idx" ON "product_descriptions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_descriptions_status_idx" ON "product_descriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_links_team_id_idx" ON "product_links" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "product_links_product_id_idx" ON "product_links" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_links_account_id_idx" ON "product_links" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_links_account_external_unique" ON "product_links" USING btree ("account_id","external_product_id");--> statement-breakpoint
CREATE INDEX "product_options_product_id_idx" ON "product_options" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_options_product_name_unique" ON "product_options" USING btree ("product_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_options_product_position_unique" ON "product_options" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_team_id_idx" ON "product_variants" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_product_sku_unique" ON "product_variants" USING btree ("product_id","sku");--> statement-breakpoint
CREATE INDEX "products_team_id_idx" ON "products" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_team_handle_unique" ON "products" USING btree ("team_id","handle");--> statement-breakpoint
CREATE INDEX "set_events_set_id_idx" ON "set_events" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "set_events_team_id_idx" ON "set_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "set_items_set_id_idx" ON "set_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "set_items_team_item_idx" ON "set_items" USING btree ("team_id","item_type","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "set_items_unique_item_in_set" ON "set_items" USING btree ("set_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "sets_team_id_idx" ON "sets" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sets_team_variant_id_idx" ON "sets" USING btree ("team_id","variant_id");--> statement-breakpoint
CREATE INDEX "sets_team_batch_id_idx" ON "sets" USING btree ("team_id","batch_id");--> statement-breakpoint
CREATE INDEX "sets_team_variant_default_idx" ON "sets" USING btree ("team_id","variant_id","is_default");--> statement-breakpoint
CREATE INDEX "sets_team_deleted_at_idx" ON "sets" USING btree ("team_id","deleted_at");--> statement-breakpoint
CREATE INDEX "team_credits_team_idx" ON "team_credits" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_credits_period_idx" ON "team_credits" USING btree ("team_id","period_start");--> statement-breakpoint
CREATE INDEX "uploaded_files_team_id_idx" ON "uploaded_files" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "uploaded_files_team_kind_idx" ON "uploaded_files" USING btree ("team_id","kind");--> statement-breakpoint
CREATE INDEX "usage_records_team_idx" ON "usage_records" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "usage_records_credits_idx" ON "usage_records" USING btree ("team_credits_id");--> statement-breakpoint
CREATE INDEX "variant_generations_team_id_idx" ON "variant_generations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "variant_generations_variant_id_idx" ON "variant_generations" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_generations_status_idx" ON "variant_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "variant_generations_moodboard_id_idx" ON "variant_generations" USING btree ("moodboard_id");--> statement-breakpoint
CREATE INDEX "variant_images_team_id_idx" ON "variant_images" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "variant_images_variant_id_idx" ON "variant_images" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_images_generation_id_idx" ON "variant_images" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "variant_links_team_id_idx" ON "variant_links" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "variant_links_variant_id_idx" ON "variant_links" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_links_account_id_idx" ON "variant_links" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_links_account_variant_unique" ON "variant_links" USING btree ("account_id","external_variant_id");--> statement-breakpoint
CREATE INDEX "variant_option_values_variant_id_idx" ON "variant_option_values" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_option_values_variant_option_unique" ON "variant_option_values" USING btree ("variant_id","product_option_id");
--> statement-breakpoint
DO $$
DECLARE
  start_at bigint := 100000;
  r record;
  seq_name text;
  next_val bigint;
BEGIN
  /*
    Bump all sequence-backed "id" columns (serial) so the first generated id is >= start_at.
    This is NOT a security boundary—authorization must still be enforced via team scoping.
  */
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
  LOOP
    seq_name := pg_get_serial_sequence(format('%I.%I', r.table_schema, r.table_name), 'id');
    IF seq_name IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT COALESCE(MAX(id) + 1, 1) FROM %I.%I', r.table_schema, r.table_name)
      INTO next_val;
    next_val := GREATEST(start_at, next_val);

    -- is_called=false => next nextval() returns exactly next_val
    EXECUTE format('SELECT setval(%L::regclass, %s, false)', seq_name, next_val);
  END LOOP;
END $$;