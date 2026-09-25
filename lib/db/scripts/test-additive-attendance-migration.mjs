import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations/0001_add_attendance_registers.sql",
);
const migrationSql = await readFile(migrationPath, "utf8");
const schema = `attendance_migration_test_${process.pid}_${Date.now()}`;
const quotedSchema = `"${schema}"`;
const client = new Client({ connectionString: databaseUrl });

function serialState(rows) {
  return rows.map(row => ({
    sequence_name: row.sequence_name,
    last_value: Number(row.last_value),
    is_called: row.is_called,
  }));
}

async function existingSequenceState() {
  const result = await client.query(`
    SELECT 'attendance_id_seq' AS sequence_name, last_value, is_called FROM attendance_id_seq
    UNION ALL
    SELECT 'courses_id_seq', last_value, is_called FROM courses_id_seq
    UNION ALL
    SELECT 'schedule_id_seq', last_value, is_called FROM schedule_id_seq
    UNION ALL
    SELECT 'students_id_seq', last_value, is_called FROM students_id_seq
    ORDER BY sequence_name
  `);
  return serialState(result.rows);
}

async function applyMigration() {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL search_path TO ${quotedSchema}`);
    await client.query(migrationSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

try {
  await client.connect();
  await client.query(`CREATE SCHEMA ${quotedSchema}`);
  await client.query(`SET search_path TO ${quotedSchema}`);
  await client.query(`
    CREATE TABLE courses (
      id serial PRIMARY KEY,
      code text NOT NULL UNIQUE,
      name text NOT NULL
    );
    CREATE TABLE students (
      id serial PRIMARY KEY,
      person_code text NOT NULL UNIQUE
    );
    CREATE TABLE schedule (
      id serial PRIMARY KEY,
      course_id integer NOT NULL REFERENCES courses(id),
      start_time text NOT NULL,
      end_time text NOT NULL
    );
    CREATE TABLE attendance (
      id serial PRIMARY KEY,
      student_id integer NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      date date NOT NULL,
      status text NOT NULL,
      notes text,
      created_at timestamp without time zone NOT NULL DEFAULT now(),
      marked_by text
    );
  `);
  await client.query(`
    INSERT INTO courses (code, name) VALUES ('C001', 'Existing course');
    INSERT INTO students (person_code) VALUES ('STU001');
    INSERT INTO schedule (course_id, start_time, end_time) VALUES (1, '08:30', '09:30');
    INSERT INTO attendance (student_id, course_id, date, status, notes, marked_by)
    VALUES (1, 1, '2026-08-28', 'present', 'existing note', 'existing staff');
  `);

  const beforeRows = await client.query(`
    SELECT id, student_id, course_id, date::text, status, notes, created_at::text, marked_by
    FROM attendance
    ORDER BY id
  `);
  const beforeSequences = await existingSequenceState();

  await applyMigration();
  await applyMigration();
  await client.query(`SET search_path TO ${quotedSchema}`);

  const afterRows = await client.query(`
    SELECT id, student_id, course_id, date::text, status, notes, created_at::text, marked_by
    FROM attendance
    ORDER BY id
  `);
  const afterSequences = await existingSequenceState();
  assert.deepEqual(afterRows.rows, beforeRows.rows, "existing attendance values changed");
  assert.deepEqual(afterSequences, beforeSequences, "existing sequence state changed");

  const relations = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name IN ('attendance_registers', 'attendance_register_audit')
     ORDER BY table_name`,
    [schema],
  );
  assert.deepEqual(
    relations.rows.map(row => row.table_name),
    ["attendance_register_audit", "attendance_registers"],
  );

  const columns = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'attendance'
       AND column_name IN ('schedule_id', 'minutes_late', 'updated_at')
     ORDER BY column_name`,
    [schema],
  );
  assert.deepEqual(
    columns.rows.map(row => row.column_name),
    ["minutes_late", "schedule_id", "updated_at"],
  );

  const indexes = await client.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = $1
       AND indexname IN (
         'attendance_student_schedule_date_unique',
         'attendance_register_schedule_date_unique',
         'attendance_register_audit_occurrence_idx'
       )
     ORDER BY indexname`,
    [schema],
  );
  assert.equal(indexes.rowCount, 3, "attendance indexes were not created");

  console.log("Additive attendance migration preserved populated rows and existing sequences.");
} finally {
  if (client._connected) {
    await client.query("RESET search_path").catch(() => {});
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
    await client.end();
  }
}