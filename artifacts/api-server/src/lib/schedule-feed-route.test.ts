import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  GetTodayScheduleResponse,
  type AuthUser,
} from "@workspace/api-zod";
import {
  createScheduleRouter,
  type ScheduleFeedRecord,
  type ScheduleFeedRepository,
} from "../routes/schedule";

function user(role: AuthUser["role"] = "staff"): AuthUser {
  return {
    id: `user-${role}`,
    email: null,
    firstName: "Ben",
    lastName: "O'Brien",
    profileImageUrl: null,
    role,
    username: "ben",
    department: null,
  };
}

function record(overrides: Partial<ScheduleFeedRecord> = {}): ScheduleFeedRecord {
  return {
    id: 1,
    courseId: 1,
    startTime: "10:15",
    endTime: "11:15",
    room: "B12",
    staffName: "Mr Ben O'Brien",
    day: null,
    registerMarked: false,
    courseCode: "Y11-DT-G1",
    courseName: "Digital Technology",
    courseStaffName: "Mr Ben O'Brien",
    ...overrides,
  };
}

function repositoryFor(
  records: ScheduleFeedRecord[],
  enrollments: Array<{ courseId: number; studentId: number }> = [],
  statuses: Map<number, "draft" | "submitted"> = new Map(),
  staffAccounts: Array<{ displayName: string | null; username: string | null }> = [],
) {
  const calls: Array<{ scheduleIds: number[]; occurrenceDates: string[] }> = [];
  const repository: ScheduleFeedRepository = {
    listActiveScheduleRecords: async () => records,
    listEnrollments: async () => enrollments,
    listRegisters: async (scheduleIds, occurrenceDates) => {
      calls.push({ scheduleIds, occurrenceDates });
      return scheduleIds.flatMap(scheduleId => {
        const status = statuses.get(scheduleId);
        if (!status || occurrenceDates.length === 0) return [];
        const updatedAt = new Date("2026-09-25T11:20:00.000Z");
        return [{
          scheduleId,
          date: occurrenceDates[0],
          status,
          updatedAt,
          submittedAt: status === "submitted" ? updatedAt : null,
        }];
      });
    },
    listLegacyAttendance: async () => [],
    listStaffAccountIdentities: async () => staffAccounts,
  };

  return { repository, calls };
}

async function requestAudit(
  currentUser: AuthUser | null,
  repository: ScheduleFeedRepository,
): Promise<{ status: number; cacheControl: string | null; body: unknown }> {
  const app = express();
  app.use((req, _res, next) => {
    const authenticatedRequest = req as unknown as {
      isAuthenticated: () => boolean;
      user?: AuthUser;
    };
    authenticatedRequest.isAuthenticated = () => currentUser !== null;
    if (currentUser) authenticatedRequest.user = currentUser;
    next();
  });
  app.use(createScheduleRouter(repository));
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo | null;
    assert.ok(address);
    const response = await fetch(
      `http://127.0.0.1:${address.port}/schedule/staff-assignment-audit`,
    );
    return {
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

async function requestFeed(
  currentUser: AuthUser | null,
  repository: ScheduleFeedRepository,
): Promise<{ status: number; cacheControl: string | null; body: unknown }> {
  const app = express();
  app.use((req, _res, next) => {
    const authenticatedRequest = req as unknown as {
      isAuthenticated: () => boolean;
      user?: AuthUser;
    };
    authenticatedRequest.isAuthenticated = () => currentUser !== null;
    if (currentUser) authenticatedRequest.user = currentUser;
    next();
  });
  app.use(createScheduleRouter(repository));
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Register feed failed" });
  });

  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo | null;
    assert.ok(address);
    const response = await fetch(`http://127.0.0.1:${address.port}/schedule/today`);
    return {
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

test("authenticated register feed returns real assigned occurrences with roster and lifecycle data", async () => {
  const records = [
    record({ id: 1, courseId: 1, courseCode: "Y11-DT-G1" }),
    record({
      id: 2,
      courseId: 2,
      staffName: null,
      courseStaffName: "Ben O'Brien",
      courseCode: "Y11-IT-G1",
      courseName: "Information Technology",
      room: null,
    }),
    record({
      id: 3,
      courseId: 3,
      courseCode: "Y10-IT-G1",
      courseName: "Year 10 Information Technology",
    }),
    record({
      id: 4,
      courseId: 4,
      staffName: "Mrs Claire Jones",
      courseStaffName: "Mrs Claire Jones",
    }),
  ];
  const { repository, calls } = repositoryFor(
    records,
    [
      { courseId: 1, studentId: 101 },
      { courseId: 1, studentId: 102 },
      { courseId: 3, studentId: 103 },
      { courseId: 4, studentId: 104 },
    ],
    new Map([[2, "draft"], [3, "submitted"]]),
  );

  const response = await requestFeed(user(), repository);
  assert.equal(response.status, 200);
  assert.equal(response.cacheControl, "private, no-store, max-age=0");

  const parsed = GetTodayScheduleResponse.safeParse(response.body);
  assert.equal(parsed.success, true, "the live response matches the generated API contract");

  const feed = response.body as Array<{
    id: number;
    courseCode: string;
    occurrenceDate: string;
    day: string | null;
    startTime: string;
    endTime: string;
    room: string | null;
    enrolledCount: number;
    registerStatus: string;
    registerSubmittedAt: string | null;
  }>;
  assert.deepEqual(feed.map(({ id }) => id), [1, 2, 3]);
  assert.deepEqual(feed.map(({ registerStatus }) => registerStatus), ["open", "draft", "submitted"]);
  assert.deepEqual(feed.map(({ enrolledCount }) => enrolledCount), [2, 0, 1]);
  assert.equal(feed[0].courseCode, "Y11-DT-G1");
  assert.equal(feed[0].occurrenceDate, feed[1].occurrenceDate);
  assert.equal(feed[0].day, null);
  assert.equal(feed[0].startTime, "10:15");
  assert.equal(feed[0].endTime, "11:15");
  assert.equal(feed[0].room, "B12");
  assert.equal(feed[2].registerSubmittedAt, "2026-09-25T11:20:00.000Z");
  assert.deepEqual(calls.map(({ scheduleIds }) => scheduleIds), [[1, 2, 3]]);
});

test("empty assignments return an empty feed without lifecycle reads", async () => {
  const { repository, calls } = repositoryFor([]);
  const response = await requestFeed(user(), repository);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
  assert.deepEqual(calls, []);
});

test("apostrophe-less timetable staff names appear in the assigned register feed", async () => {
  const { repository } = repositoryFor([
    record({ staffName: "Mr Ben OBrien", courseStaffName: "Mr Ben O'Brien" }),
  ]);

  const response = await requestFeed(user(), repository);
  assert.equal(response.status, 200);
  assert.deepEqual(
    (response.body as Array<{ id: number }>).map(({ id }) => id),
    [1],
  );
});

test("administrators and heads of department retain oversight of all active feed rows", async () => {
  const records = [
    record({ id: 1, staffName: "Mr Ben O'Brien" }),
    record({ id: 2, staffName: "Mrs Claire Jones" }),
  ];

  for (const role of ["admin", "hod"] as const) {
    const { repository } = repositoryFor(records);
    const response = await requestFeed(user(role), repository);
    assert.equal(response.status, 200);
    assert.deepEqual(
      (response.body as Array<{ id: number }>).map(({ id }) => id),
      [1, 2],
      `${role} should see both active timetable assignments`,
    );
  }
});

test("admin assignment audit reports unmatched assignments without learner data", async () => {
  const records = [
    record({
      id: 1,
      staffName: "Mrs Claire Jones",
      courseStaffName: "Mr Ben O'Brien",
      courseCode: "Y7-IT-G1",
    }),
    record({
      id: 2,
      staffName: null,
      courseStaffName: "Mr Ben OBrien",
      courseCode: "Y10-DT-G1",
    }),
    record({
      id: 3,
      staffName: "ben",
      courseStaffName: "Someone Else",
      courseCode: "Y11-DT-G1",
    }),
    record({
      id: 4,
      staffName: " ",
      courseStaffName: null,
      courseCode: "UNASSIGNED",
    }),
  ];
  const { repository } = repositoryFor(
    records,
    [{ courseId: 1, studentId: 501 }],
    new Map(),
    [{ displayName: "Ben O'Brien", username: "ben" }],
  );

  const response = await requestAudit(user("admin"), repository);
  assert.equal(response.status, 200);
  assert.equal(response.cacheControl, "private, no-store, max-age=0");
  assert.deepEqual(response.body, {
    scheduleCount: 4,
    assignedCount: 3,
    matchedCount: 2,
    unmatchedCount: 1,
    uniqueUnmatchedStaffCount: 1,
    examples: [{
      scheduleId: 1,
      courseCode: "Y7-IT-G1",
      assignedStaffName: "Mrs Claire Jones",
      assignmentSource: "schedule",
    }],
  });
  assert.equal(JSON.stringify(response.body).includes("studentId"), false);
  assert.equal(JSON.stringify(response.body).includes("enrolledCount"), false);
});

test("only administrators can read the staff assignment audit", async () => {
  const { repository } = repositoryFor([]);
  let repositoryReads = 0;
  repository.listActiveScheduleRecords = async () => {
    repositoryReads++;
    return [];
  };
  repository.listStaffAccountIdentities = async () => {
    repositoryReads++;
    return [];
  };

  assert.equal((await requestAudit(null, repository)).status, 401);
  assert.equal((await requestAudit(user("staff"), repository)).status, 403);
  assert.equal((await requestAudit(user("hod"), repository)).status, 403);
  assert.equal(repositoryReads, 0);
});

test("a failed register query stays an HTTP failure instead of becoming an empty schedule", async () => {
  const repository: ScheduleFeedRepository = {
    listActiveScheduleRecords: async () => [record()],
    listEnrollments: async () => [],
    listRegisters: async () => {
      throw new Error("attendance_registers relation is unavailable");
    },
    listLegacyAttendance: async () => [],
    listStaffAccountIdentities: async () => [],
  };

  const response = await requestFeed(user(), repository);
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "Register feed failed" });
});