ALTER TABLE "sets" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "sets_team_variant_default_idx" ON "sets" ("team_id","variant_id","is_default");


