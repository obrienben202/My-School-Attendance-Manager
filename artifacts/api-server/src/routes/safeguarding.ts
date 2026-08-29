import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, safeguardingNotesTable, studentsTable, usersTable } from "@workspace/db";
import {
  CreateSafeguardingNoteBody,
  ListSafeguardingNotesResponse,
  ListSafeguardingNotesResponseItem,
} from "@workspace/api-zod";
import { canAccessSafeguarding } from "../lib/safeguarding-access";
import { validateSafeguardingNoteInput } from "../lib/safeguarding-note-validation";

const router = Router();

function requireSafeguardingAccess(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }

  if (!canAccessSafeguarding(req.user)) {
    res.status(403).json({ error: "Safeguarding access denied" });
    return false;
  }

  return true;
}

function noteResponse(row: {
  id: number;
  studentId: number;
  learnerSurname: string;
  learnerForename: string;
  personCode: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  content: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    studentId: row.studentId,
    learnerName: `${row.learnerSurname}, ${row.learnerForename}`,
    personCode: row.personCode,
    author: [row.authorFirstName, row.authorLastName].filter(Boolean).join(" ") || "Authorised staff member",
    content: row.content,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function listNotes() {
  const rows = await db
    .select({
      id: safeguardingNotesTable.id,
      studentId: safeguardingNotesTable.studentId,
      learnerSurname: studentsTable.surname,
      learnerForename: studentsTable.forename,
      personCode: studentsTable.personCode,
      authorFirstName: usersTable.firstName,
      authorLastName: usersTable.lastName,
      content: safeguardingNotesTable.content,
      status: safeguardingNotesTable.status,
      createdAt: safeguardingNotesTable.createdAt,
      updatedAt: safeguardingNotesTable.updatedAt,
    })
    .from(safeguardingNotesTable)
    .innerJoin(studentsTable, eq(safeguardingNotesTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(safeguardingNotesTable.authorUserId, usersTable.id))
    .orderBy(desc(safeguardingNotesTable.createdAt));

  return rows.map(noteResponse);
}

router.get("/safeguarding/notes", async (req, res): Promise<void> => {
  if (!requireSafeguardingAccess(req, res)) return;

  const records = await listNotes();
  ListSafeguardingNotesResponse.parse(records);
  res.json(records);
});

router.post("/safeguarding/notes", async (req, res): Promise<void> => {
  if (!requireSafeguardingAccess(req, res)) return;

  const parsed = CreateSafeguardingNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select a learner and enter a note before sending." });
    return;
  }
  const validationError = validateSafeguardingNoteInput(parsed.data);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const [student] = await db
    .select({
      id: studentsTable.id,
      surname: studentsTable.surname,
      forename: studentsTable.forename,
      personCode: studentsTable.personCode,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, parsed.data.studentId))
    .limit(1);

  if (!student) {
    res.status(400).json({ error: "The selected learner could not be found." });
    return;
  }

  const [inserted] = await db
    .insert(safeguardingNotesTable)
    .values({
      studentId: student.id,
      authorUserId: req.user!.id,
      content: parsed.data.content.trim(),
      status: "active",
    })
    .returning({
      id: safeguardingNotesTable.id,
      studentId: safeguardingNotesTable.studentId,
      content: safeguardingNotesTable.content,
      status: safeguardingNotesTable.status,
      createdAt: safeguardingNotesTable.createdAt,
      updatedAt: safeguardingNotesTable.updatedAt,
    });

  const response = noteResponse({
    ...inserted,
    learnerSurname: student.surname,
    learnerForename: student.forename,
    personCode: student.personCode,
    authorFirstName: req.user!.firstName,
    authorLastName: req.user!.lastName,
  });
  ListSafeguardingNotesResponseItem.parse(response);
  res.status(201).json(response);
});

export default router;