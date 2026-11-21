-- Additive development migration. Safeguarding notes retain their learner and author links.
CREATE TABLE IF NOT EXISTS safeguarding_notes (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  author_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
