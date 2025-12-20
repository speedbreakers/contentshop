-- Remove legacy upload kind 'moodboard' in favor of explicit moodboard_* kinds.
-- Safe default: map to moodboard_reference_positive.

UPDATE uploaded_files
SET kind = 'moodboard_reference_positive'
WHERE kind = 'moodboard';


