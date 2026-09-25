import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { db } from "@workspace/db";
import eprogressionsRouter from "../routes/eprogressions";

type Role = "admin" | "hod" | "staff" | "office" | "unknown" | null;
const operations = [
  { method: "GET", path: "/eprogressions" },
  { method: "POST", path: "/eprogressions" },
  { method: "PATCH", path: "/eprogressions/1" },
  { method: "DELETE", path: "/eprogressions/1" },
] as const;

async function withServer(run: (request: (role: Role, method: string, path: string, body?: object) => Promise<Response>) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.header("x-test-role") as Role;
    req.user = role ? { role } as Express.User : undefined;
    req.isAuthenticated = function (this: typeof req) { return this.user != null; } as typeof req.isAuthenticated;
    next();
  });
  app.use(eprogressionsRouter);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run((role, method, path, body) => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { ...(role ? { "x-test-role": role } : {}), "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("every eProgression route rejects anonymous and unknown-role requests before validation or data access", async () => {
  await withServer(async request => {
    for (const operation of operations) {
      for (const [role, expected] of [[null, 401], ["unknown", 403]] as const) {
        const response = await request(role, operation.method, operation.path,
          operation.method === "GET" ? undefined : {});
        assert.equal(response.status, expected, `${operation.method} ${operation.path} (${role})`);
      }
    }
  });
});

test("staff roles can list and submit, but only admins can decide and delete", async () => {
  await withServer(async request => {
    for (const role of ["admin", "hod", "staff", "office"] as const) {
      // Invalid input is intentionally used to verify these roles reach validation
      // without touching the database. A role failure would be 403 instead.
      assert.equal((await request(role, "GET", "/eprogressions?studentId=not-a-number")).status, 400);
      assert.equal((await request(role, "POST", "/eprogressions", {})).status, 400);
    }
    for (const role of ["hod", "staff", "office"] as const) {
      for (const status of ["Authorised", "Rejected", "Pending"]) {
        assert.equal((await request(role, "PATCH", "/eprogressions/1", { status })).status, 403);
      }
      assert.equal((await request(role, "DELETE", "/eprogressions/1")).status, 403);
    }
    assert.equal((await request("admin", "PATCH", "/eprogressions/1", { status: "Pending" })).status, 400);
  });
});

test("authorised operations can complete; decisions only update pending submissions", async () => {
  const database = db as unknown as Record<string, unknown>;
  const original = { select: database.select, transaction: database.transaction, update: database.update, delete: database.delete };
  const row = {
    id: 1, type: "learner", courseCode: "TEST", newProgressCode: "P1",
    progressDate: "2026-09-25", status: "Pending", submittedAt: new Date("2026-09-25T12:00:00Z"),
  };
  let stored = { ...row };
  let deleted = false;
  try {
    database.select = () => ({
      from: () => ({ orderBy: async () => deleted ? [] : [stored] }),
    });
    database.transaction = async (callback: (tx: object) => Promise<unknown>) => callback({
      execute: async () => undefined,
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: () => ({ returning: async () => [stored] }) }),
    });
    database.update = () => ({
      set: (data: { status: string }) => ({
        where: () => ({
          returning: async () => {
            if (stored.status !== "Pending") return [];
            stored = { ...stored, status: data.status };
            return [stored];
          },
        }),
      }),
    });
    database.delete = () => ({ where: async () => { deleted = true; } });

    await withServer(async request => {
      for (const role of ["admin", "hod", "staff", "office"] as const) {
        const listed = await request(role, "GET", "/eprogressions");
        assert.equal(listed.status, 200);
        assert.equal((await listed.json() as unknown[]).length, 1);
        const submitted = await request(role, "POST", "/eprogressions", {
          courseCode: "TEST", newProgressCode: "P1", progressDate: "2026-09-25",
        });
        assert.equal(submitted.status, 201);
        assert.equal((await submitted.json() as { status: string }).status, "Pending");
      }
      const decided = await request("admin", "PATCH", "/eprogressions/1", { status: "Authorised" });
      assert.equal(decided.status, 200);
      assert.equal((await decided.json() as { status: string }).status, "Authorised");
      assert.equal((await request("admin", "PATCH", "/eprogressions/1", { status: "Rejected" })).status, 404);
      stored = { ...row };
      const rejected = await request("admin", "PATCH", "/eprogressions/1", { status: "Rejected" });
      assert.equal(rejected.status, 200);
      assert.equal((await rejected.json() as { status: string }).status, "Rejected");
      assert.equal((await request("admin", "DELETE", "/eprogressions/1")).status, 204);
      assert.equal(deleted, true);
    });
  } finally {
    Object.assign(database, original);
  }
});