-- Add selectedDescriptionId to products table
ALTER TABLE "products" ADD COLUMN "selected_description_id" integer;

-- Create product_descriptions table
CREATE TABLE IF NOT EXISTS "product_descriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "product_id" integer NOT NULL REFERENCES "products"("id"),
  "status" varchar(20) DEFAULT 'generating' NOT NULL,
  "prompt" text NOT NULL,
  "tone" varchar(20),
  "length" varchar(20),
  "content" text,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "product_descriptions_team_id_idx" ON "product_descriptions" ("team_id");
CREATE INDEX IF NOT EXISTS "product_descriptions_product_id_idx" ON "product_descriptions" ("product_id");
CREATE INDEX IF NOT EXISTS "product_descriptions_status_idx" ON "product_descriptions" ("status");

