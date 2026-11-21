-- Additive development migration. Existing groups start at revision zero.
-- Production schema changes are reviewed and applied through Publish, never startup.
ALTER TABLE ilp_groups ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
