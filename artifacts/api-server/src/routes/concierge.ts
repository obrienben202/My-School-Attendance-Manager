import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  conciergeApplicationsTable,
  coursesTable,
  enrolmentPhotoUploadsTable,
  enrollmentsTable,
  studentsTable,
} from "@workspace/db";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import {
  AssociateConciergeEnrolmentPhotoBody,
  CreateConciergeEnrolmentBody,
} from "@workspace/api-zod";
import { requireConciergeAccess } from "../lib/concierge-access";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

router.get("/concierge/applications", async (req, res) => {
  const { status, search } = req.query as { status?: string; search?: string };
  let rows = await db.select().from(conciergeApplicationsTable).orderBy(conciergeApplicationsTable.createdAt);

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.forename && r.forename.toLowerCase().includes(s)) ||
        (r.surname && r.surname.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s))
    );
  }

  res.json(rows);
});

router.post("/concierge/applications", async (req, res) => {
  const [row] = await db.insert(conciergeApplicationsTable).values(req.body).returning();
  res.status(201).json(row);
});

router.get("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .select()
    .from(conciergeApplicationsTable)
    .where(eq(conciergeApplicationsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.patch("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .update(conciergeApplicationsTable)
    .set(req.body)
    .where(eq(conciergeApplicationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(conciergeApplicationsTable).where(eq(conciergeApplicationsTable.id, id));
  res.status(204).send();
});

function enrolmentResponse(row: {
  enrollment: typeof enrollmentsTable.$inferSelect;
  student: typeof studentsTable.$inferSelect;
  course: typeof coursesTable.$inferSelect;
}) {
  return {
    id: row.enrollment.id,
    studentId: row.enrollment.studentId,
    courseId: row.enrollment.courseId,
    forename: row.student.forename,
    surname: row.student.surname,
    email: row.enrollment.contactEmail,
    courseCode: row.course.code,
    course: row.course.name,
    progressCode: "A",
    photoObjectPath: row.enrollment.photoObjectPath,
    photoContentType: row.enrollment.photoContentType,
    photoUpdatedAt: row.enrollment.photoUpdatedAt,
    createdAt: row.enrollment.createdAt,
  };
}

async function findEnrolment(id: number) {
  const [row] = await db
    .select({
      enrollment: enrollmentsTable,
      student: studentsTable,
      course: coursesTable,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .where(eq(enrollmentsTable.id, id));
  return row;
}

router.get("/concierge/enrolments", async (req, res) => {
  if (!requireConciergeAccess(req, res)) return;
  const rows = await db
    .select({
      enrollment: enrollmentsTable,
      student: studentsTable,
      course: coursesTable,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
    .orderBy(studentsTable.surname, studentsTable.forename);
  res.json(rows.map(enrolmentResponse));
});

router.post("/concierge/enrolments", async (req, res) => {
  if (!requireConciergeAccess(req, res)) return;
  const parsed = CreateConciergeEnrolmentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Provide the learner name, email address, and course." });
  }
  const input = parsed.data;
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, input.courseId));
  if (!course) return res.status(404).json({ error: "The selected course no longer exists." });

  const [application] = input.applicationId
    ? await db
        .select()
        .from(conciergeApplicationsTable)
        .where(eq(conciergeApplicationsTable.id, input.applicationId))
    : [undefined];
  if (input.applicationId && !application) {
    return res.status(404).json({ error: "The source application no longer exists." });
  }

  const existingStudentId = input.studentId ?? application?.studentId ?? undefined;
  const [existingStudent] = existingStudentId
    ? await db.select().from(studentsTable).where(eq(studentsTable.id, existingStudentId))
    : [undefined];
  if (existingStudentId && !existingStudent) {
    return res.status(404).json({ error: "The selected learner no longer exists." });
  }

  try {
    const enrolmentId = await db.transaction(async (tx) => {
      let studentId = existingStudent?.id;
      const studentDetails = {
        forename: input.forename.trim(),
        surname: input.surname.trim(),
        dateOfBirth: input.dateOfBirth?.toISOString().slice(0, 10),
        gender: input.gender === "prefer_not" ? null : input.gender,
        postCode: input.postCode?.trim() || undefined,
        confirmedLearner: true,
      };
      if (studentId) {
        await tx.update(studentsTable).set(studentDetails).where(eq(studentsTable.id, studentId));
      } else {
        const [student] = await tx
          .insert(studentsTable)
          .values({
            personCode: `ENR-${randomUUID().slice(0, 12).toUpperCase()}`,
            ...studentDetails,
          })
          .returning();
        studentId = student.id;
      }

      const [enrolment] = await tx
        .insert(enrollmentsTable)
        .values({
          studentId,
          courseId: input.courseId,
          contactEmail: input.email.trim().toLowerCase(),
        })
        .onConflictDoUpdate({
          target: [enrollmentsTable.studentId, enrollmentsTable.courseId],
          set: { contactEmail: input.email.trim().toLowerCase() },
        })
        .returning();

      if (application) {
        await tx
          .update(conciergeApplicationsTable)
          .set({
            studentId,
            courseId: input.courseId,
            email: input.email.trim().toLowerCase(),
            status: "Enrolled",
          })
          .where(eq(conciergeApplicationsTable.id, application.id));
      }
      return enrolment.id;
    });
    const row = await findEnrolment(enrolmentId);
    if (!row) throw new Error("Completed enrolment could not be reloaded.");
    return res.status(201).json(enrolmentResponse(row));
  } catch (error) {
    req.log.error({ err: error }, "Failed to complete learner enrolment");
    return res.status(500).json({ error: "The enrolment could not be saved. Check the details and try again." });
  }
});

router.get("/concierge/enrolments/:id", async (req, res) => {
  if (!requireConciergeAccess(req, res)) return;
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid enrolment id" });
  const row = await findEnrolment(id);
  if (!row) return res.status(404).json({ error: "Enrolment not found" });
  res.json(enrolmentResponse(row));
  return;
});

router.post("/concierge/enrolments/:id/photo", async (req, res) => {
  if (!requireConciergeAccess(req, res)) return;
  const id = Number.parseInt(req.params.id, 10);
  const parsed = AssociateConciergeEnrolmentPhotoBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    return res.status(400).json({ error: "Provide a valid uploaded JPEG or PNG photo reference." });
  }

  const row = await findEnrolment(id);
  if (!row) return res.status(404).json({ error: "Enrolment not found" });

  const [issuedUpload] = await db
    .select()
    .from(enrolmentPhotoUploadsTable)
    .where(
      and(
        eq(enrolmentPhotoUploadsTable.enrollmentId, id),
        eq(enrolmentPhotoUploadsTable.objectPath, parsed.data.objectPath),
        eq(enrolmentPhotoUploadsTable.requestedBy, req.user.id),
        isNull(enrolmentPhotoUploadsTable.consumedAt),
      ),
    );
  if (!issuedUpload || issuedUpload.expectedContentType !== parsed.data.contentType) {
    return res.status(400).json({ error: "This upload was not issued for this learner. Choose the photo again." });
  }

  try {
    await storage.validateEnrolmentPhoto(parsed.data.objectPath, {
      size: issuedUpload.expectedSize,
      contentType: parsed.data.contentType,
    });
  } catch (error) {
    req.log.warn({ err: error, enrolmentId: id }, "Rejected invalid learner photo upload");
    return res.status(400).json({ error: "The uploaded file did not match the selected JPEG or PNG. Choose it again." });
  }

  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx
      .update(enrollmentsTable)
      .set({
        photoObjectPath: parsed.data.objectPath,
        photoContentType: parsed.data.contentType,
        photoUpdatedAt: new Date(),
      })
      .where(eq(enrollmentsTable.id, id))
      .returning();
    await tx
      .update(enrolmentPhotoUploadsTable)
      .set({ consumedAt: new Date() })
      .where(eq(enrolmentPhotoUploadsTable.id, issuedUpload.id));
    return saved;
  });
  res.json(enrolmentResponse({ ...row, enrollment: updated }));
  return;
});

export default router;
