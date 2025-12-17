CREATE TABLE IF NOT EXISTS "batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "settings" jsonb,
  "variant_count" integer NOT NULL DEFAULT 0,
  "image_count" integer NOT NULL DEFAULT 0,
  "folder_id" integer REFERENCES "sets"("id"),
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "batch_id" integer REFERENCES "batches"("id");
CREATE INDEX IF NOT EXISTS "generation_jobs_batch_id_idx" ON "generation_jobs" ("batch_id");

-- Optional tag for sets that belong to a batch. Not a foreign key to avoid circular references.
ALTER TABLE "sets" ADD COLUMN IF NOT EXISTS "batch_id" integer;
CREATE INDEX IF NOT EXISTS "sets_team_batch_id_idx" ON "sets" ("team_id", "batch_id");

CREATE INDEX IF NOT EXISTS "batches_team_id_idx" ON "batches" ("team_id");
CREATE INDEX IF NOT EXISTS "batches_status_idx" ON "batches" ("status");
CREATE INDEX IF NOT EXISTS "batches_team_created_at_idx" ON "batches" ("team_id", "created_at");


