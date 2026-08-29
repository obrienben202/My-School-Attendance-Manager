import assert from "node:assert/strict";
import test from "node:test";
import {
  replaceAttendanceRegister,
  type AttendanceRegisterMark,
  type AttendanceRegisterTransaction,
} from "./attendance-register";

type FakeRow = {
  id: number;
  studentId: number;
  courseId: number;
  scheduleId: number;
  date: string;
  status: string;
  notes: string | null;
  markedBy: string | null;
  createdAt: Date;
};

const scheduleId = 42;
const courseId = 7;
const date = "2026-08-29";

function row(id: number, studentId: number, status: string): FakeRow {
  return {
    id,
    studentId,
    courseId,
    scheduleId,
    date,
    status,
    notes: null,
    markedBy: "previous-user",
    createdAt: new Date("2026-08-29T09:00:00.000Z"),
  };
}

class FakeTransaction {
  rows: FakeRow[] = [];
  registerMarked = false;
  lockCalls = 0;
  failInsert = false;
  private releaseLock: (() => void) | undefined;

  constructor(private readonly database: FakeDatabase) {}

  async execute(_query: unknown): Promise<void> {
    this.lockCalls += 1;
    await this.database.acquireLock(this);
    this.rows = this.database.rows.map(existing => ({ ...existing }));
    this.registerMarked = this.database.registerMarked;
  }

  release(): void {
    this.releaseLock?.();
    this.releaseLock = undefined;
  }

  setRelease(release: () => void): void {
    this.releaseLock = release;
  }

  delete(_table?: unknown) {
    return {
      where: async (_condition?: unknown) => {
        this.rows = [];
      },
    };
  }

  insert(_table?: unknown) {
    return {
      values: (values: Array<{
        studentId: number;
        courseId: number;
        scheduleId: number;
        date: string;
        status: string;
        notes?: string;
        markedBy: string;
      }>) => ({
        returning: async () => {
          if (this.failInsert) throw new Error("simulated insert failure");
          const inserted = values.map(value => ({
            ...value,
            id: this.database.allocateId(),
            notes: value.notes ?? null,
            markedBy: value.markedBy,
            createdAt: new Date("2026-08-29T10:00:00.000Z"),
          }));
          this.rows.push(...inserted);
          return inserted;
        },
      }),
    };
  }

  update(_table?: unknown) {
    return {
      set: (values: { registerMarked: boolean }) => ({
        where: async (_condition?: unknown) => {
          this.registerMarked = values.registerMarked;
        },
      }),
    };
  }
}

class FakeDatabase {
  rows: FakeRow[];
  registerMarked: boolean;
  private lockTail = Promise.resolve();
  private idSequence = 100;

  constructor(rows: FakeRow[], registerMarked = true) {
    this.rows = rows;
    this.registerMarked = registerMarked;
  }

  async acquireLock(transaction: FakeTransaction): Promise<void> {
    const previous = this.lockTail;
    let release!: () => void;
    this.lockTail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    transaction.setRelease(release);
  }

  allocateId(): number {
    return this.idSequence++;
  }

  async transaction<T>(callback: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    const transaction = new FakeTransaction(this);
    try {
      const result = await callback(transaction);
      this.rows = transaction.rows.map(existing => ({ ...existing }));
      this.registerMarked = transaction.registerMarked;
      return result;
    } finally {
      transaction.release();
    }
  }

  async replace(marks: ReadonlyArray<AttendanceRegisterMark>, failInsert = false): Promise<FakeRow[]> {
    return this.transaction(async transaction => {
      transaction.failInsert = failInsert;
      return replaceAttendanceRegister(
        transaction as unknown as AttendanceRegisterTransaction,
        {
          scheduleId,
          courseId,
          date,
          marks,
          markedBy: "current-user",
        },
      ) as Promise<FakeRow[]>;
    });
  }
}

test("a failed register replacement leaves every previous mark and register flag intact", async () => {
  const database = new FakeDatabase([row(1, 101, "present"), row(2, 102, "absent")]);

  await assert.rejects(
    database.replace([{ studentId: 101, status: "late" }], true),
    /simulated insert failure/,
  );

  assert.deepEqual(database.rows.map(existing => [existing.studentId, existing.status]), [
    [101, "present"],
    [102, "absent"],
  ]);
  assert.equal(database.registerMarked, true);
});

test("concurrent replacements for one lesson/date serialize without duplicate learner marks", async () => {
  const database = new FakeDatabase([row(1, 101, "present")]);

  await Promise.all([
    database.replace([
      { studentId: 101, status: "absent" },
      { studentId: 102, status: "present" },
    ]),
    database.replace([
      { studentId: 101, status: "late" },
      { studentId: 102, status: "absent" },
    ]),
  ]);

  assert.equal(database.rows.length, 2);
  assert.equal(new Set(database.rows.map(existing => existing.studentId)).size, 2);
  assert.ok(database.rows.every(existing => existing.scheduleId === scheduleId && existing.date === date));
  assert.deepEqual(
    database.rows
      .map(existing => [existing.studentId, existing.status])
      .sort(([left], [right]) => Number(left) - Number(right)),
    [
      [101, "late"],
      [102, "absent"],
    ],
  );
});

test("the register replacement operation can clear a register and its marked flag together", async () => {
  const database = new FakeDatabase([row(1, 101, "present")]);

  await database.replace([]);

  assert.deepEqual(database.rows, []);
  assert.equal(database.registerMarked, false);
});