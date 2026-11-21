import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID) {
  throw new Error("This migration check is development-only");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const migration = await readFile(new URL("../migrations/0006_add_ilp_group_revision.sql", import.meta.url), "utf8");
// Every object is isolated in a transaction that is rolled back, even on failure.
const schema = `ilp_revision_check_${process.pid}_${Date.now()}`;
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE users (id VARCHAR PRIMARY KEY);
    INSERT INTO users VALUES ('synthetic-admin');
  `);
  await client.query(await readFile(new URL("../migrations/0003_add_ilp_groups.sql", import.meta.url), "utf8"));
  await client.query(`
    INSERT INTO ilp_groups (name, filters, default_year, created_by_id, created_by)
    VALUES ('Existing default', '[]', 7, 'synthetic-admin', 'Synthetic administrator'),
           ('Existing custom', '[{"field":"Year Group","operator":"equals","value":"Year 8"}]', NULL, 'synthetic-admin', 'Synthetic administrator');
  `);
  const before = (await client.query("SELECT * FROM ilp_groups ORDER BY id")).rows;
  const sequenceBefore = (await client.query("SELECT last_value, is_called FROM ilp_groups_id_seq")).rows;
  await client.query(migration);
  const after = (await client.query("SELECT * FROM ilp_groups ORDER BY id")).rows;
  assert.deepEqual(after.map(({ revision, ...row }) => row), before, "Existing group data changed");
  assert.deepEqual(after.map(row => row.revision), [0, 0], "Existing groups need initial revisions");
  assert.deepEqual((await client.query("SELECT last_value, is_called FROM ilp_groups_id_seq")).rows, sequenceBefore);
  await client.query("UPDATE ilp_groups SET revision = 5 WHERE default_year IS NULL");
  await client.query(migration);
  assert.deepEqual((await client.query("SELECT revision FROM ilp_groups ORDER BY id")).rows, [{ revision: 0 }, { revision: 5 }], "Reapplying the migration reset a revision");
  const inserted = await client.query("INSERT INTO ilp_groups (name, filters, created_by) VALUES ('New group', '[]', 'Synthetic administrator') RETURNING revision");
  assert.equal(inserted.rows[0].revision, 0);
  console.log("ILP group revision migration preserves populated groups and sequences, initializes revisions, and is idempotent.");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
