import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import attendanceRouter from "../routes/attendance";
import scheduleRouter from "../routes/schedule";

test("register contact addresses reject unauthenticated requests before data access", async () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => false;
    next();
  });
  app.use(attendanceRouter);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/attendance/register/contacts?scheduleId=1&date=2026-08-24`,
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

test("register feed rejects unauthenticated requests before timetable data access", async () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => false;
    next();
  });
  app.use(scheduleRouter);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/schedule/today`,
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});