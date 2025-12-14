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
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
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
CREATE INDEX "set_events_set_id_idx" ON "set_events" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "set_events_team_id_idx" ON "set_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "set_items_set_id_idx" ON "set_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "set_items_team_item_idx" ON "set_items" USING btree ("team_id","item_type","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "set_items_unique_item_in_set" ON "set_items" USING btree ("set_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "sets_team_id_idx" ON "sets" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sets_team_variant_id_idx" ON "sets" USING btree ("team_id","variant_id");--> statement-breakpoint
CREATE INDEX "sets_team_deleted_at_idx" ON "sets" USING btree ("team_id","deleted_at");