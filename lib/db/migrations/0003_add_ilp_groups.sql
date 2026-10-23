-- Additive development migration only. Defaults are initialized by authenticated
-- requests so Publish schema sync does not depend on copying development data.
CREATE TABLE IF NOT EXISTS ilp_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  default_year INTEGER,
  created_by_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ilp_groups_default_year_range CHECK (default_year IS NULL OR default_year BETWEEN 7 AND 11)
);
CREATE UNIQUE INDEX IF NOT EXISTS ilp_groups_default_year ON ilp_groups(default_year);