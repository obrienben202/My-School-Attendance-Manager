import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, plannedAbsencesTable, studentsTable, usersTable } from "@workspace/db";
import { CreatePlannedAbsenceBody, ListPlannedAbsencesResponse } from "@workspace/api-zod";
import { validatePlannedAbsenceInput } from "../lib/planned-absence-validation";

const router = Router();

function requireAuthenticated(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function listForUser(userId: string) {
  const rows = await db
    .select({
      id: plannedAbsencesTable.id,
      studentId: plannedAbsencesTable.studentId,
      learnerSurname: studentsTable.surname,
      learnerForename: studentsTable.forename,
      personCode: studentsTable.personCode,
      fromDate: plannedAbsencesTable.fromDate,
      toDate: plannedAbsencesTable.toDate,
      reason: plannedAbsencesTable.reason,
      partDay: plannedAbsencesTable.partDay,
      startTime: plannedAbsencesTable.startTime,
      endTime: plannedAbsencesTable.endTime,
      notes: plannedAbsencesTable.notes,
      status: plannedAbsencesTable.status,
      submittedBy: usersTable.firstName,
      submittedByLastName: usersTable.lastName,
      createdAt: plannedAbsencesTable.createdAt,
      updatedAt: plannedAbsencesTable.updatedAt,
    })
    .from(plannedAbsencesTable)
    .innerJoin(studentsTable, eq(plannedAbsencesTable.studentId, studentsTable.id))
    .leftJoin(usersTable, eq(plannedAbsencesTable.submittedByUserId, usersTable.id))
    .where(eq(plannedAbsencesTable.submittedByUserId, userId))
    .orderBy(desc(plannedAbsencesTable.createdAt));

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    learnerName: `${row.learnerSurname}, ${row.learnerForename}`,
    personCode: row.personCode,
    fromDate: row.fromDate,
    toDate: row.toDate,
    reason: row.reason,
    partDay: row.partDay,
    startTime: row.startTime,
    endTime: row.endTime,
    notes: row.notes,
    status: "pending" as const,
    submittedBy: [row.submittedBy, row.submittedByLastName].filter(Boolean).join(" ") || "Current user",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

router.get("/planned-absences", async (req, res): Promise<void> => {
  if (!requireAuthenticated(req, res)) return;
  const userId = req.user?.id;
  if (!userId) return;
  const records = await listForUser(userId);
  ListPlannedAbsencesResponse.parse(records);
  res.json(records);
});

router.post("/planned-absences", async (req, res): Promise<void> => {
  if (!requireAuthenticated(req, res)) return;
  const userId = req.user?.id;
  if (!userId) return;

  const parsed = CreatePlannedAbsenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Learner, dates, and reason are required." });
    return;
  }

  const data = parsed.data;
  const fromDate = data.fromDate instanceof Date ? data.fromDate.toISOString().slice(0, 10) : data.fromDate;
  const toDate = data.toDate instanceof Date ? data.toDate.toISOString().slice(0, 10) : data.toDate;
  const validationError = validatePlannedAbsenceInput({
    fromDate,
    toDate,
    reason: data.reason,
    partDay: data.partDay,
    startTime: data.startTime,
    endTime: data.endTime,
  }, todayUtc());
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.id, data.studentId)).limit(1);
  if (!student) {
    res.status(400).json({ error: "The selected learner could not be found." });
    return;
  }

  const [inserted] = await db.insert(plannedAbsencesTable).values({
    studentId: data.studentId,
    submittedByUserId: userId,
    fromDate,
    toDate,
    reason: data.reason.trim(),
    partDay: data.partDay ?? false,
    startTime: data.partDay ? data.startTime ?? null : null,
    endTime: data.partDay ? data.endTime ?? null : null,
    notes: data.notes?.trim() || null,
    status: "pending",
  }).returning({ id: plannedAbsencesTable.id });

  const records = await listForUser(userId);
  const created = records.find((record) => record.id === inserted.id);
  if (!created) {
    req.log.error({ plannedAbsenceId: inserted.id }, "Created planned absence could not be reloaded");
    res.status(500).json({ error: "The request was saved but could not be reloaded. Refresh to view it." });
    return;
  }
  ListPlannedAbsencesResponse.element.parse(created);
  res.status(201).json(created);
});

export default router;