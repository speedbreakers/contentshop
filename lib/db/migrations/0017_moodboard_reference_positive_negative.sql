-- Migrate legacy moodboard reference assets into the new positive/negative buckets.
-- Existing 'reference' entries become 'reference_positive' (safe default).

UPDATE moodboard_assets
SET kind = 'reference_positive'
WHERE kind = 'reference';


