ALTER TABLE "moodboard_assets"
ADD COLUMN IF NOT EXISTS "kind" varchar(20) NOT NULL DEFAULT 'reference';

CREATE INDEX IF NOT EXISTS "moodboard_assets_kind_idx" ON "moodboard_assets" ("kind");


