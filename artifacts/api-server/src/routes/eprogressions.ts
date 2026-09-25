import { Router } from "express";
import { db } from "@workspace/db";
import { eprogressionsTable } from "@workspace/db";
import {
  and,
  eq,
  isNull,
  sql,
} from "drizzle-orm";
import {
  CreateEprogressionBody,
  UpdateEprogressionBody,
  ListEprogressionsQueryParams,
  ListEprogressionsResponse,
  ListEprogressionsResponseItem,
  UpdateEprogressionParams,
  UpdateEprogressionResponse,
  DeleteEprogressionParams,
} from "@workspace/api-zod";
import { requireEprogressionAccess } from "../lib/eprogression-access";

const router = Router();
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function toEprogressionResponse(row: typeof eprogressionsTable.$inferSelect) {
  return {
    ...row,
    submittedAt: row.submittedAt.toISOString(),
  };
}

router.get("/eprogressions", async (req, res) => {
  if (!requireEprogressionAccess(req, res, "list")) return;
  const parsedQuery = ListEprogressionsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }
  const { studentId, courseId, status } = parsedQuery.data;

  let rows = await db
    .select()
    .from(eprogressionsTable)
    .orderBy(eprogressionsTable.submittedAt);

  if (studentId !== undefined) rows = rows.filter((r) => r.studentId === studentId);
  if (courseId !== undefined) rows = rows.filter((r) => r.courseId === courseId);
  if (status) rows = rows.filter((r) => r.status === status);

  const response = rows.map(toEprogressionResponse);
  ListEprogressionsResponse.parse(response);
  res.json(response);
});

router.post("/eprogressions", async (req, res) => {
  if (!requireEprogressionAccess(req, res, "submit")) return;
  const parsed = CreateEprogressionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isValidDateOnly(req.body?.progressDate)) {
    res.status(400).json({ error: "progressDate must be a valid date in YYYY-MM-DD format" });
    return;
  }

  const data = { ...parsed.data, progressDate: req.body.progressDate };
  const type = data.type ?? "learner";
  const studentCondition = data.studentId === null || data.studentId === undefined
    ? isNull(eprogressionsTable.studentId)
    : eq(eprogressionsTable.studentId, data.studentId);
  const courseCondition = data.courseId === null || data.courseId === undefined
    ? isNull(eprogressionsTable.courseId)
    : eq(eprogressionsTable.courseId, data.courseId);

  // Serialize requests for the same progression identity so a double click or
  // retried request updates one pending record instead of creating two.
  const row = await db.transaction(async (tx) => {
    const dedupeKey = [
      type,
      data.studentId ?? "none",
      data.courseId ?? "none",
      data.progressDate,
    ].join(":");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${dedupeKey}))`);

    const [existing] = await tx
      .select()
      .from(eprogressionsTable)
      .where(and(
        eq(eprogressionsTable.type, type),
        studentCondition,
        courseCondition,
        eq(eprogressionsTable.progressDate, data.progressDate),
        eq(eprogressionsTable.status, "Pending"),
      ))
      .limit(1);

    const values = {
      ...data,
      type,
      status: "Pending",
    };

    if (existing) {
      const [updated] = await tx
        .update(eprogressionsTable)
        .set(values)
        .where(eq(eprogressionsTable.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(eprogressionsTable)
      .values(values)
      .returning();
    return created;
  });

  const response = toEprogressionResponse(row);
  ListEprogressionsResponseItem.parse(response);
  res.status(201).json(response);
});

router.patch("/eprogressions/:id", async (req, res) => {
  if (!requireEprogressionAccess(req, res, "decide")) return;
  const parsedParams = UpdateEprogressionParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  const parsed = UpdateEprogressionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .update(eprogressionsTable)
    .set(parsed.data)
    .where(and(
      eq(eprogressionsTable.id, parsedParams.data.id),
      eq(eprogressionsTable.status, "Pending"),
    ))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Pending eProgression not found" });
    return;
  }
  const response = toEprogressionResponse(row);
  UpdateEprogressionResponse.parse(response);
  res.json(response);
});

router.delete("/eprogressions/:id", async (req, res) => {
  if (!requireEprogressionAccess(req, res, "delete")) return;
  const parsedParams = DeleteEprogressionParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  await db.delete(eprogressionsTable).where(eq(eprogressionsTable.id, parsedParams.data.id));
  res.status(204).send();
});

export default router;
