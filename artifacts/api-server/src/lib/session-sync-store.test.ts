import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool as unusedDefaultPool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { parseSessionSheet, type SessionCourse } from "./session-sync";
import { persistSessionSnapshot } from "./session-sync-store";
import { TECHNOLOGY_TIMETABLE_SOURCE } from "./timetable-sync";
import { refreshSessionSheet } from "./session-sync-stage";
import { persistMaintainedTimetable } from "./timetable-sync-store";
import pg from "pg";
import express from "express";
import { once } from "node:events";
import attendanceRouter from "../routes/attendance";

test("isolated SQL: additive retirement, partial takeover, edits, rollback, persistence and complete register history", {
  skip: process.env.RUN_SESSION_DB_TESTS !== "1", timeout: 30_000,
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.ok(!process.env.REPLIT_DEPLOYMENT && !process.env.REPLIT_DEPLOYMENT_ID);
  const namespace = `session_fixture_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const makePool = () => new pg.Pool({
    connectionString: process.env.DATABASE_URL, options: `-c search_path=${namespace}`,
  });
  let pool = makePool();
  const migration = await readFile(new URL("../../../../lib/db/migrations/0004_retire_schedule_slots.sql", import.meta.url), "utf8");
  const header = ["id", "code", "Day", "Start Time", "End Time", "Week Pattern"];
  const courseFixtures: SessionCourse[] = [
    { id: 1, sourceId: "8", code: "Y10-DT-G1", room: "Lab", staffName: "Fixture Teacher" },
    { id: 2, sourceId: "10", code: "Y11-DT-G1", room: null, staffName: "Other Teacher" },
  ];
  const rows = [
    header,
    ["8", "Y10-DT-G1", "Monday", "09:00", "10:45", "Every Week"],
    ["8", "Y10-DT-G1", "Wednesday", "11:05", "12:45", "Week A"],
  ];
  const slots = () => parseSessionSheet(rows, courseFixtures).slots;
  const repository = () => drizzle(pool, { schema });
  const schedules = async () => (await pool.query("select * from schedule order by id")).rows;
  const history = async () => Promise.all(["attendance", "attendance_registers", "attendance_register_audit"]
    .map(async table => (await pool.query(`select * from ${table} order by id`)).rows));
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    await admin.connect();
    await admin.query(`create schema "${namespace}"`);
    await pool.query(`
      create table courses (id serial primary key, code text not null, staff_name text);
      create table schedule (
        id serial primary key, course_id integer not null references courses(id),
        day text, start_time text not null, end_time text not null, room text,
        staff_name text, week_pattern text not null default 'Every week',
        register_marked boolean not null default false, source text, source_key text,
        created_at timestamp not null default now()
      );
      create table attendance (
        id serial primary key, schedule_id integer references schedule(id) on delete set null,
        date date not null default '2026-09-28', status text not null, notes text
      );
      create table attendance_registers (
        id serial primary key, schedule_id integer not null references schedule(id) on delete cascade,
        date date not null, status text not null, submitted_at timestamptz,
        updated_by text not null default 'fixture',
        updated_at timestamptz not null default now(), created_at timestamptz not null default now()
      );
      create table attendance_register_audit (
        id serial primary key, schedule_id integer not null references schedule(id) on delete cascade,
        date date not null default '2026-09-28', action text not null, details text not null,
        user_id text not null default 'fixture', created_at timestamptz not null default now()
      );
      create table users (id text primary key, first_name text, last_name text, username text);
      insert into courses (code) values ('Y10-DT-G1'), ('Y11-DT-G1');
    `);
    // Populate before applying the additive migration; rerunning must be safe.
    await pool.query(`insert into schedule (course_id,day,start_time,end_time,source,source_key,staff_name,room)
      values (1,'Monday','08:30','10:30',$1,'legacy-mon','Legacy Teacher','Old room'),
             (1,'Friday','13:30','14:30',$1,'legacy-fri','Legacy Teacher','Old room'),
             (2,'Tuesday','09:00','10:00',$1,'unlisted','Other Teacher',null),
             (1,'Thursday','15:00','16:00',null,null,'Manual Teacher',null),
             (1,'Thursday','16:00','17:00','unrelated-import','unrelated','Other Teacher',null),
             (1,'Thursday','12:00','12:45',$1,'legacy-other','Legacy Teacher',null)`,
      [TECHNOLOGY_TIMETABLE_SOURCE]);
    await pool.query(`
      insert into attendance (schedule_id,status,notes) values (1,'present','original mark'),(2,'late','original note');
      insert into attendance_registers (schedule_id,date,status,submitted_at)
        values (1,'2026-09-28','submitted','2026-09-28T10:30:00Z'),(2,'2026-09-25','submitted','2026-09-25T14:30:00Z');
      insert into attendance_register_audit (schedule_id,action,details)
        values (1,'submit','original audit'),(2,'submit','retired audit');
    `);
    const beforeHistory = await history();
    await pool.query(migration);
    await pool.query(migration);
    assert.ok((await schedules()).every(s => s.is_active));
    const unchangedOthers = (await schedules()).filter(s => [3, 4, 5].includes(s.id));

    const first = await persistSessionSnapshot(slots(), repository());
    assert.deepEqual(first, { inserted: 1, updated: 1, unchanged: 0, retired: 2 });
    assert.deepEqual(await history(), beforeHistory);
    assert.equal((await schedules()).find(s => s.id === 1).start_time, "09:00");
    assert.equal((await schedules()).find(s => s.id === 2).is_active, false);
    assert.deepEqual((await schedules()).filter(s => [3, 4, 5].includes(s.id)), unchangedOthers);
    const stable = await schedules();
    assert.deepEqual(await persistSessionSnapshot([...slots()].reverse(), repository()),
      { inserted: 0, updated: 0, unchanged: 2, retired: 0 });
    assert.deepEqual(await schedules(), stable);
    // An older legacy run cannot overwrite or reinstate a sheet-owned course.
    for (let run = 0; run < 2; run++) {
      await persistMaintainedTimetable([{
        courseId: 1, day: "Friday", startTime: "08:30", endTime: "10:30",
        room: "Old room", staffName: "Legacy Teacher", weekPattern: "Every week",
        source: TECHNOLOGY_TIMETABLE_SOURCE, sourceKey: "legacy-fri",
      }, {
        courseId: 2, day: "Tuesday", startTime: "09:00", endTime: "10:00",
        room: null, staffName: "Other Teacher", weekPattern: "Every week",
        source: TECHNOLOGY_TIMETABLE_SOURCE, sourceKey: "unlisted",
      }], repository());
      assert.deepEqual(await schedules(), stable);
    }

    // Change both day and time after an exact match anchors the other identity.
    rows[1] = ["8", "Y10-DT-G1", "Tuesday", "09:15", "10:45", "Every Week"];
    const edited = await persistSessionSnapshot(slots(), repository());
    assert.equal(edited.updated, 1);
    assert.equal((await schedules()).find(s => s.id === 1).day, "Tuesday");
    assert.deepEqual(await history(), beforeHistory);

    // The real read routes must still serve historical dates after a day edit.
    // Scope the default route DB pool exclusively to this synthetic schema.
    unusedDefaultPool.options.options = `-c search_path=${namespace}`;
    const app = express();
    let role = "admin";
    app.use((req, _res, next) => {
      req.isAuthenticated = (() => true) as typeof req.isAuthenticated;
      req.user = { id: "fixture", role, firstName: "Fixture", lastName: "Teacher" } as Express.User;
      next();
    });
    app.use("/api", attendanceRouter);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/attendance/register`;
    let response = await fetch(`${base}/state?scheduleId=1&date=2026-09-28`);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { status: string }).status, "submitted");
    response = await fetch(`${base}/audit?scheduleId=1&date=2026-09-28`);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { details: string }[])[0].details, "original audit");
    assert.equal((await fetch(`${base}/state?scheduleId=1&date=2026-10-05`)).status, 400);
    // Retired identities serve saved occurrences, but never create new ones.
    assert.equal((await fetch(`${base}/state?scheduleId=2&date=2026-09-25`)).status, 200);
    assert.equal((await fetch(`${base}/state?scheduleId=2&date=2026-10-02`)).status, 400);
    role = "staff";
    assert.equal((await fetch(`${base}/state?scheduleId=1&date=2026-09-28`)).status, 200);
    assert.equal((await fetch(`${base}/state?scheduleId=2&date=2026-09-25`)).status, 403);
    assert.deepEqual(await history(), beforeHistory);

    // A SQL failure after the first update rolls back the entire snapshot.
    await pool.query("alter table schedule add constraint fixture_fail check (start_time <> '18:00')");
    const beforeRollback = await schedules();
    const broken = slots().map((s, i) => ({ ...s, startTime: i ? "18:00" : "09:30" }));
    await assert.rejects(persistSessionSnapshot(broken, repository()));
    assert.deepEqual(await schedules(), beforeRollback);
    await pool.query("alter table schedule drop constraint fixture_fail");

    for (const load of [
      async () => [] as string[][],
      async () => [header],
      async () => [header, ["8", "WRONG", "Monday", "09:00", "10:45", "Every Week"]],
      async () => { throw new Error("Sessions tab unavailable"); },
    ]) {
      const entry = await refreshSessionSheet(load, async () => courseFixtures,
        snapshot => persistSessionSnapshot(snapshot, repository()));
      assert.ok(entry.errors.length);
      assert.deepEqual(await schedules(), beforeRollback);
    }

    // Omit one session from a represented course: retire it without deleting.
    rows.splice(2, 1);
    assert.equal((await persistSessionSnapshot(slots(), repository())).retired, 1);
    assert.deepEqual(await history(), beforeHistory);
    const persisted = await schedules();
    await pool.end();
    pool = makePool(); // a new process/connection can read the same persisted feed
    assert.deepEqual(await schedules(), persisted);
    assert.deepEqual(await persistSessionSnapshot(slots(), repository()),
      { inserted: 0, updated: 0, unchanged: 1, retired: 0 });
    assert.deepEqual(await history(), beforeHistory);
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await pool.end();
    await admin.query(`drop schema if exists "${namespace}" cascade`);
    await admin.end();
    await unusedDefaultPool.end();
  }
});