-- Additive development migration only; never run during production startup.
-- Preserve existing assessments, marks and their original timestamps.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS tutor text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

UPDATE assessments SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE assessments
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE assessment_results
  ADD COLUMN IF NOT EXISTS grade_released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

UPDATE assessment_results SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE assessment_results
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;