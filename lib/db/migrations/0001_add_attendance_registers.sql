-- Additive development migration for occurrence-scoped attendance.
-- This file intentionally touches only attendance-owned objects. Production
-- schema changes continue to be handled by Replit's Publish schema diff.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS schedule_id integer,
  ADD COLUMN IF NOT EXISTS minutes_late integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

UPDATE attendance
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE attendance
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'attendance'::regclass
      AND conname = 'attendance_schedule_id_schedule_id_fk'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_schedule_id_schedule_id_fk
      FOREIGN KEY (schedule_id)
      REFERENCES schedule(id)
      ON DELETE SET NULL;
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_schedule_date_unique
  ON attendance (student_id, schedule_id, date);

CREATE TABLE IF NOT EXISTS attendance_registers (
  id serial PRIMARY KEY,
  schedule_id integer NOT NULL
    REFERENCES schedule(id)
    ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  updated_by text NOT NULL,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_register_schedule_date_unique
  ON attendance_registers (schedule_id, date);

CREATE TABLE IF NOT EXISTS attendance_register_audit (
  id serial PRIMARY KEY,
  schedule_id integer NOT NULL
    REFERENCES schedule(id)
    ON DELETE CASCADE,
  date date NOT NULL,
  action text NOT NULL,
  user_id text NOT NULL,
  details text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_register_audit_occurrence_idx
  ON attendance_register_audit (schedule_id, date, created_at);