CREATE TABLE IF NOT EXISTS "variant_generations" (
  "id" serial PRIMARY KEY,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "variant_id" integer NOT NULL REFERENCES "product_variants"("id"),
  "schema_key" varchar(50) NOT NULL,
  "input" jsonb NOT NULL,
  "number_of_variations" integer NOT NULL DEFAULT 1,
  "provider" varchar(30) NOT NULL DEFAULT 'mock',
  "status" varchar(20) NOT NULL DEFAULT 'generating',
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "variant_generations_team_id_idx" ON "variant_generations" ("team_id");
CREATE INDEX IF NOT EXISTS "variant_generations_variant_id_idx" ON "variant_generations" ("variant_id");
CREATE INDEX IF NOT EXISTS "variant_generations_status_idx" ON "variant_generations" ("status");

CREATE TABLE IF NOT EXISTS "variant_images" (
  "id" serial PRIMARY KEY,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "variant_id" integer NOT NULL REFERENCES "product_variants"("id"),
  "generation_id" integer REFERENCES "variant_generations"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'ready',
  "url" text NOT NULL,
  "prompt" text,
  "schema_key" varchar(50),
  "input" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "variant_images_team_id_idx" ON "variant_images" ("team_id");
CREATE INDEX IF NOT EXISTS "variant_images_variant_id_idx" ON "variant_images" ("variant_id");
CREATE INDEX IF NOT EXISTS "variant_images_generation_id_idx" ON "variant_images" ("generation_id");


