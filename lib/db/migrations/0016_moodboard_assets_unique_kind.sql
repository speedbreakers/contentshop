-- Allow the same uploaded_file_id to be attached to a moodboard in multiple sections (kind).
-- Previously we enforced uniqueness on (moodboard_id, uploaded_file_id), which prevented using the same
-- image in both Backgrounds and Models.

DROP INDEX IF EXISTS "moodboard_assets_moodboard_file_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "moodboard_assets_moodboard_file_kind_unique"
  ON "moodboard_assets" ("moodboard_id", "uploaded_file_id", "kind");


