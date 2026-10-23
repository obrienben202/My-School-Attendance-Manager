import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

test("assessment metadata migration preserves existing marks, supports repeats and new writes", async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.ok(!process.env.REPLIT_DEPLOYMENT && !process.env.REPLIT_DEPLOYMENT_ID);
  const namespace = `assessment_migration_${randomUUID().replaceAll("-", "")}`;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const migration = await readFile(new URL("../migrations/0005_add_assessment_metadata.sql", import.meta.url), "utf8");
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`SET LOCAL search_path TO "${namespace}"`);
    await client.query(`
      CREATE TABLE assessments (
        id serial PRIMARY KEY, code text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE assessment_results (
        id serial PRIMARY KEY, assessment_id integer NOT NULL REFERENCES assessments(id),
        result text, status text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
      );
      INSERT INTO assessments(code,created_at) VALUES ('fixture','2026-01-01T10:00:00');
      INSERT INTO assessment_results(assessment_id,result,status,created_at)
        VALUES (1,'87','Released','2026-01-02T10:00:00'),(1,'55','Not Marked','2026-01-03T10:00:00');
    `);
    const legacy = async () => Promise.all([
      client.query("SELECT id,code,created_at FROM assessments ORDER BY id"),
      client.query("SELECT id,assessment_id,result,status,created_at FROM assessment_results ORDER BY id"),
    ]).then(results => results.map(r => r.rows));
    const before = await legacy();
    await client.query(migration);
    assert.deepEqual(await legacy(), before);
    assert.ok((await client.query("SELECT tutor, updated_at=created_at AS original_time FROM assessments"))
      .rows.every(row => row.tutor === null && row.original_time));
    assert.ok((await client.query("SELECT grade_released_at, updated_at=created_at AS original_time FROM assessment_results"))
      .rows.every(row => row.grade_released_at === null && row.original_time));
    // A repeat must not overwrite a subsequently edited timestamp or release.
    await client.query("UPDATE assessments SET tutor='Fixture Tutor',updated_at='2026-02-01T10:00:00Z' WHERE id=1");
    await client.query("UPDATE assessment_results SET grade_released_at='2026-02-02T10:00:00Z',updated_at='2026-02-02T10:00:00Z' WHERE id=1");
    const edited = await Promise.all([
      client.query("SELECT * FROM assessments ORDER BY id"),
      client.query("SELECT * FROM assessment_results ORDER BY id"),
    ]).then(results => results.map(r => r.rows));
    await client.query(migration);
    assert.deepEqual(await legacy(), before);
    assert.deepEqual(await Promise.all([
      client.query("SELECT * FROM assessments ORDER BY id"),
      client.query("SELECT * FROM assessment_results ORDER BY id"),
    ]).then(results => results.map(r => r.rows)), edited);
    assert.ok((await client.query("INSERT INTO assessments(code) VALUES ('new') RETURNING updated_at")).rows[0].updated_at);
    assert.ok((await client.query("INSERT INTO assessment_results(assessment_id,result,status) VALUES (2,'70','Not Marked') RETURNING updated_at")).rows[0].updated_at);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});