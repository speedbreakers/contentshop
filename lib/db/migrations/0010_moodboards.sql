CREATE TABLE IF NOT EXISTS "moodboards" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "name" varchar(255) NOT NULL,
  "description" text,
  "style_profile" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "moodboards_team_id_idx" ON "moodboards" ("team_id");
CREATE INDEX IF NOT EXISTS "moodboards_team_deleted_at_idx" ON "moodboards" ("team_id", "deleted_at");

CREATE TABLE IF NOT EXISTS "moodboard_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "teams"("id"),
  "moodboard_id" integer NOT NULL REFERENCES "moodboards"("id"),
  "uploaded_file_id" integer NOT NULL REFERENCES "uploaded_files"("id"),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "moodboard_assets_team_id_idx" ON "moodboard_assets" ("team_id");
CREATE INDEX IF NOT EXISTS "moodboard_assets_moodboard_id_idx" ON "moodboard_assets" ("moodboard_id");
CREATE UNIQUE INDEX IF NOT EXISTS "moodboard_assets_moodboard_file_unique" ON "moodboard_assets" ("moodboard_id", "uploaded_file_id");

ALTER TABLE "variant_generations" ADD COLUMN IF NOT EXISTS "moodboard_id" integer REFERENCES "moodboards"("id");
CREATE INDEX IF NOT EXISTS "variant_generations_moodboard_id_idx" ON "variant_generations" ("moodboard_id");



