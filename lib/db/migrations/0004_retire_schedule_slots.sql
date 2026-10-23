-- Additive retirement: keep attendance, submissions and audits linked to their
-- original schedule. No table recreation, deletion or identity changes.
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;