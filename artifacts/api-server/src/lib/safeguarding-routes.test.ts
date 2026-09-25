import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { db } from "@workspace/db";
import reportsRouter from "../routes/reports";
import safeguardingRouter from "../routes/safeguarding";

type Role = "admin" | "hod" | "staff" | "office";
type RequestRole = Role | null;

type StoredNote = {
  id: number;
  studentId: number;
  learnerSurname: string;
  learnerForename: string;
  personCode: string;
  authorFirstName: string;
  authorLastName: string;
  content: string;
  status: string;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

async function withServer(
  run: (request: (role: RequestRole, method: "GET" | "POST", path: string, body?: object) => Promise<Response>) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.header("x-test-role") as Role | undefined;
    if (role) {
      req.user = {
        id: `${role}-user`,
        firstName: role === "hod" ? "Head" : role[0].toUpperCase() + role.slice(1),
        lastName: "Tester",
        role,
      } as Express.User;
    }
    req.isAuthenticated = function (this: typeof req) {
      return this.user != null;
    } as typeof req.isAuthenticated;
    next();
  });
  app.use(safeguardingRouter);
  app.use(reportsRouter);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run((role, method, path, body) => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        ...(role ? { "x-test-role": role } : {}),
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()),
    );
  }
}

test("safeguarding notes are role-protected and persisted with the signed-in author", async () => {
  const database = db as unknown as Record<string, unknown>;
  const original = { select: database.select, insert: database.insert };
  const student = {
    id: 25,
    surname: "Learner",
    forename: "Test",
    personCode: "TEST025",
  };
  const notes: StoredNote[] = [];
  const insertedAuthorIds: string[] = [];
  let selectCalls = 0;
  let insertCalls = 0;

  try {
    database.select = () => {
      selectCalls += 1;
      const chain = {
        innerJoin: () => chain,
        orderBy: async () => notes.map(note => ({ ...note })),
        where: (_condition: unknown) => ({ limit: async () => [student] }),
      };
      return { from: () => chain };
    };
    database.insert = () => ({
      values: (values: {
        studentId: number;
        authorUserId: string;
        content: string;
        status: string;
        lastContactedAt: Date | null;
      }) => ({
        returning: async () => {
          insertCalls += 1;
          insertedAuthorIds.push(values.authorUserId);
          const role = values.authorUserId.replace(/-user$/, "");
          const firstName = role === "hod" ? "Head" : role[0].toUpperCase() + role.slice(1);
          const now = new Date("2026-09-25T12:00:00.000Z");
          const note: StoredNote = {
            id: notes.length + 1,
            studentId: values.studentId,
            learnerSurname: student.surname,
            learnerForename: student.forename,
            personCode: student.personCode,
            authorFirstName: firstName,
            authorLastName: "Tester",
            content: values.content,
            status: values.status,
            lastContactedAt: values.lastContactedAt,
            createdAt: now,
            updatedAt: now,
          };
          notes.push(note);
          return [{
            id: note.id,
            studentId: note.studentId,
            content: note.content,
            status: note.status,
            lastContactedAt: note.lastContactedAt,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          }];
        },
      }),
    });

    await withServer(async request => {
      const body = { studentId: student.id, content: "Follow-up completed.", lastContactedAt: null };

      for (const [role, expectedStatus] of [[null, 401], ["office", 403]] as const) {
        assert.equal((await request(role, "GET", "/safeguarding/notes")).status, expectedStatus);
        assert.equal((await request(role, "POST", "/safeguarding/notes", body)).status, expectedStatus);
      }
      assert.equal(selectCalls, 0, "unauthorised roles must be denied before note or learner queries");
      assert.equal(insertCalls, 0, "unauthorised roles must be denied before insertion");

      for (const role of ["admin", "hod", "staff"] as const) {
        const listedBefore = await request(role, "GET", "/safeguarding/notes");
        assert.equal(listedBefore.status, 200, `${role} can list notes`);

        const created = await request(role, "POST", "/safeguarding/notes", body);
        assert.equal(created.status, 201, `${role} can create notes`);
        const createdNote = await created.json() as { id: number; author: string };
        const expectedAuthor = `${role === "hod" ? "Head" : role[0].toUpperCase() + role.slice(1)} Tester`;
        assert.equal(createdNote.author, expectedAuthor);

        const historyResponse = await request(role, "GET", "/safeguarding/notes");
        assert.equal(historyResponse.status, 200);
        const history = await historyResponse.json() as Array<{ id: number; author: string; content: string }>;
        assert.ok(history.some(note =>
          note.id === createdNote.id && note.author === expectedAuthor && note.content === body.content,
        ), `${role}'s note appears in persisted history with the correct author`);
        assert.equal(insertedAuthorIds[insertedAuthorIds.length - 1], `${role}-user`);
      }

      const callsBeforeReport = selectCalls;
      const atRiskReport = await request("admin", "GET", "/reports/sg-at-risk");
      assert.equal(atRiskReport.status, 403);
      assert.equal(selectCalls, callsBeforeReport, "admins are denied before the at-risk report accesses data");
    });
  } finally {
    Object.assign(database, original);
  }
});