-- Generation Jobs table for background image generation processing
CREATE TABLE IF NOT EXISTS "generation_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "product_id" integer NOT NULL REFERENCES "products"("id"),
  "variant_id" integer NOT NULL REFERENCES "product_variants"("id"),
  "generation_id" integer REFERENCES "variant_generations"("id"),
  
  "type" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  
  "progress" jsonb,
  "error" text,
  "metadata" jsonb,
  
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "generation_jobs_team_id_idx" ON "generation_jobs" ("team_id");
CREATE INDEX IF NOT EXISTS "generation_jobs_variant_id_idx" ON "generation_jobs" ("variant_id");
CREATE INDEX IF NOT EXISTS "generation_jobs_status_idx" ON "generation_jobs" ("status");
CREATE INDEX IF NOT EXISTS "generation_jobs_type_status_idx" ON "generation_jobs" ("type", "status");

