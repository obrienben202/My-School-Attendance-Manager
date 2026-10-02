import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db, studentsTable, usersTable, ilpTemplatesTable as templates, ilpTermsTable as terms,
  ilpAssignmentsTable as assignments, ilpReviewsTable as reviews, ilpSupportAuditTable as audit,
} from "@workspace/db";
import {
  MaintainTermlyIlpsBody, ActOnTermlyIlpReviewBody,
  GetTermlyIlpFeedResponse, GetTermlyIlpAdminResponse, GetTermlyIlpReviewResponse,
  ActOnTermlyIlpReviewResponse, MaintainTermlyIlpsResponse,
} from "@workspace/api-zod";
import { PDF_ILP_TEMPLATES } from "../lib/ilp-pdf-templates";
import { calendarDate, validAcademicYear, validateTemplate, validateWork, reviewActionAllowed, TUTOR_ROLES } from "../lib/termly-ilp-rules";

const router = Router();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class IlpError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new IlpError(status, message); }
const today = () => new Date().toISOString().slice(0, 10);

router.use("/termly-ilps", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  if (!["learner", ...TUTOR_ROLES].includes(req.user.role)) return res.status(403).json({ error: "ILP review access denied" });
  return next();
});

// Serialize maintenance against publication and the roster trigger. No saved
// review is ever updated by reconciliation.
async function maintenanceLock(tx: Tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(961003)`);
}
async function reconcile(tx: Tx) {
  const added = await tx.execute(sql`
    INSERT INTO ilp_term_reviews (student_id, term_id, template_id)
    SELECT s.id, t.id, t.template_id FROM students s CROSS JOIN ilp_review_terms t
    WHERE s.confirmed_learner = true
    ON CONFLICT (student_id, term_id) DO NOTHING RETURNING id
  `);
  return added.rowCount ?? 0;
}
async function reviewRows() {
  return db.select({
    review: reviews, term: terms, student: { id: studentsTable.id, forename: studentsTable.forename, surname: studentsTable.surname, confirmed: studentsTable.confirmedLearner },
    assignment: assignments,
  }).from(reviews)
    .innerJoin(terms, eq(reviews.termId, terms.id))
    .innerJoin(studentsTable, eq(reviews.studentId, studentsTable.id))
    .leftJoin(assignments, eq(reviews.studentId, assignments.studentId))
    .orderBy(terms.academicYear, terms.term, studentsTable.surname);
}
type JoinedReview = Awaited<ReturnType<typeof reviewRows>>[number];
function summary(r: JoinedReview, roles: Map<string, string>) {
  return {
    id: r.review.id, studentId: r.review.studentId, studentName: `${r.student.forename} ${r.student.surname}`,
    termId: r.term.id, templateId: r.review.templateId, status: r.review.status, revision: r.review.revision,
    academicYear: r.term.academicYear, term: r.term.term, startDate: r.term.startDate, endDate: r.term.endDate, deadline: r.term.deadline,
    accountLinked: roles.get(r.assignment?.learnerUserId ?? "") === "learner",
    tutorAssigned: TUTOR_ROLES.includes(roles.get(r.assignment?.tutorUserId ?? "") ?? ""),
    overdue: r.term.deadline < today() && !["submitted", "reviewed"].includes(r.review.status),
  };
}
function fullReview(r: JoinedReview, roles: Map<string, string>) {
  return { ...summary(r, roles), work: r.review.work, teacherComment: r.review.teacherComment, reviewDate: r.review.reviewDate, history: r.review.history, updatedAt: r.review.updatedAt.toISOString() };
}
async function roleMap() {
  return new Map((await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)).map(u => [u.id, u.role]));
}
function canView(r: JoinedReview, user: Express.User) {
  if (!r.student.confirmed) return false;
  return user.role === "learner"
    ? r.assignment?.learnerUserId === user.id
    : TUTOR_ROLES.includes(user.role) && r.assignment?.tutorUserId === user.id;
}
function jsonValidated(res: import("express").Response, schema: { parse: (v: unknown) => unknown }, data: unknown) {
  schema.parse(data);
  return res.json(data);
}

router.get("/termly-ilps", async (req, res) => {
  const user = req.user!;
  const links = await db.select().from(assignments).innerJoin(studentsTable, eq(assignments.studentId, studentsTable.id))
    .where(and(eq(assignments.learnerUserId, user.id), eq(studentsTable.confirmedLearner, true)));
  const linked = user.role !== "learner" || links.length === 1;
  const roles = await roleMap();
  const records = (await reviewRows()).filter(r => canView(r, user));
  return jsonValidated(res, GetTermlyIlpFeedResponse, {
    linked,
    guidance: linked ? "Open the current term, save your work, then Submit to Tutor. Your RG teacher completes the review."
      : "Your school account is verified, but is not linked to a confirmed learner record. Ask an administrator to link your account and assign your RG teacher. You cannot choose or enter another learner’s identity yourself.",
    reviews: records.map(r => summary(r, roles)),
  });
});

router.get("/termly-ilps/admin", async (req, res) => {
  if (req.user!.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
  await db.transaction(async tx => { await maintenanceLock(tx); await reconcile(tx); });
  const roles = await roleMap();
  const learners = await db.select({ student: studentsTable, assignment: assignments }).from(studentsTable)
    .leftJoin(assignments, eq(studentsTable.id, assignments.studentId)).where(eq(studentsTable.confirmedLearner, true)).orderBy(studentsTable.surname);
  const users = await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role, name: usersTable.firstName }).from(usersTable);
  return jsonValidated(res, GetTermlyIlpAdminResponse, {
    templates: await db.select().from(templates).orderBy(templates.term, templates.version),
    terms: await db.select().from(terms).orderBy(terms.academicYear, terms.term),
    learners: learners.map(({ student, assignment }) => ({
      studentId: student.id, personCode: student.personCode, studentName: `${student.forename} ${student.surname}`,
      learnerUserId: roles.get(assignment?.learnerUserId ?? "") === "learner" ? assignment!.learnerUserId : null,
      tutorUserId: TUTOR_ROLES.includes(roles.get(assignment?.tutorUserId ?? "") ?? "") ? assignment!.tutorUserId : null,
    })),
    users: users.filter(u => ["learner", ...TUTOR_ROLES].includes(u.role)).map(u => ({ ...u, username: u.username ?? "", name: u.name ?? u.username ?? "" })),
    reviews: (await reviewRows()).filter(r => r.student.confirmed).map(r => summary(r, roles)),
  });
});

router.post("/termly-ilps/admin", async (req, res) => {
  if (req.user!.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
  const parsed = MaintainTermlyIlpsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid maintenance command" });
  const input = parsed.data;
  try {
    const result = await db.transaction(async tx => {
      await maintenanceLock(tx);
      const actor = req.user!.id;
      async function record(action: string, reason: string) {
        await tx.insert(audit).values({ actorId: actor, action, reason });
      }
      if (input.action === "seed") {
        for (let i = 0; i < PDF_ILP_TEMPLATES.length; i++) {
          await tx.insert(templates).values({ term: i + 1, version: 1, status: "draft", content: PDF_ILP_TEMPLATES[i], createdBy: actor }).onConflictDoNothing();
        }
        await record("seed_templates", "Loaded supplied three-term PDF");
        return { message: "Three PDF templates are ready as drafts. Existing versions are unchanged." };
      }
      if (["clone_template", "save_template", "publish_template"].includes(input.action)) {
        const [template] = await tx.select().from(templates).where(eq(templates.id, input.templateId ?? -1)).for("update");
        if (!template) fail(404, "Template not found");
        if (input.action === "clone_template") {
          const versions = await tx.select().from(templates).where(eq(templates.term, template.term));
          const [clone] = await tx.insert(templates).values({ term: template.term, version: Math.max(...versions.map(t => t.version)) + 1, content: template.content, createdBy: actor }).returning();
          await record("clone_template", `Template ${template.id} cloned as ${clone.id}`);
          return { message: "New draft version created. Existing reviews are unchanged.", templateId: clone.id };
        }
        if (template.status !== "draft") fail(409, "Published templates are immutable. Create a new draft version.");
        if (input.revision !== template.revision) fail(409, "This template changed. Reload before saving.");
        const content = input.action === "save_template" ? input.content : template.content;
        if (!content) fail(400, "Template content is required");
        const errors = validateTemplate(content);
        if (errors.length) fail(400, errors.join("\n"));
        await tx.update(templates).set({ content, status: input.action === "publish_template" ? "published" : "draft", revision: template.revision + 1 }).where(eq(templates.id, template.id));
        await record(input.action, `Template ${template.id}`);
        return { message: input.action === "publish_template" ? "Template published. Existing reviews keep their original version." : "Draft template saved.", templateId: template.id };
      }
      if (input.action === "assign") {
        if (!input.personCode?.trim()) fail(400, "An exact verified roster person code is required");
        const roster = await tx.select().from(studentsTable).where(and(eq(studentsTable.personCode, input.personCode.trim()), eq(studentsTable.confirmedLearner, true)));
        if (roster.length !== 1) fail(400, "Person code must identify exactly one confirmed learner");
        if (input.learnerUserId === undefined || input.tutorUserId === undefined) fail(400, "Choose an account and RG teacher, or explicitly leave them unassigned");
        if (input.learnerUserId) {
          const [account] = await tx.select().from(usersTable).where(eq(usersTable.id, input.learnerUserId));
          if (account?.role !== "learner" || !account.username) fail(400, "Choose a directory-managed learner account");
          const duplicate = await tx.select().from(assignments).where(eq(assignments.learnerUserId, account.id));
          if (duplicate.some(a => a.studentId !== roster[0].id)) fail(409, "This account is already linked to another learner");
        }
        if (input.tutorUserId) {
          const [tutor] = await tx.select().from(usersTable).where(eq(usersTable.id, input.tutorUserId));
          if (!tutor || !TUTOR_ROLES.includes(tutor.role) || !tutor.username) fail(400, "Choose a directory-managed RG teacher");
        }
        const value = { studentId: roster[0].id, learnerUserId: input.learnerUserId, tutorUserId: input.tutorUserId, updatedBy: actor, updatedAt: new Date() };
        await tx.insert(assignments).values(value).onConflictDoUpdate({ target: assignments.studentId, set: value });
        await reconcile(tx);
        await record("assign", `Verified person code ${roster[0].personCode}; account and tutor mapping updated`);
        return { message: "Learner account and RG teacher assignment saved." };
      }
      if (input.action === "reconcile") {
        const newReviews = await reconcile(tx);
        await record("reconcile", "Confirmed roster reconciled without resetting work");
        return { message: "Confirmed learners reconciled. Existing work is unchanged.", newReviews };
      }
      if (input.action === "preview_term" || input.action === "publish_term") {
        if (!validAcademicYear(input.academicYear) || ![1, 2, 3].includes(input.term ?? 0) ||
          !calendarDate(input.startDate) || !calendarDate(input.endDate) || !calendarDate(input.deadline)) fail(400, "Choose academic year YYYY-YYYY, Term 1–3 and valid calendar dates");
        if (input.startDate > input.deadline || input.deadline > input.endDate) fail(400, "Deadline must be between the start and end dates");
        const [template] = await tx.select().from(templates).where(eq(templates.id, input.templateId ?? -1));
        if (!template || template.status !== "published" || template.term !== input.term) fail(400, "Choose a published template for this term");
        const [existing] = await tx.select().from(terms).where(and(eq(terms.academicYear, input.academicYear), eq(terms.term, input.term!)));
        if (existing && existing.templateId !== template.id) fail(409, "This term already uses a different version. Existing reviews cannot be silently changed.");
        const roster = await tx.select({ id: studentsTable.id, assignment: assignments }).from(studentsTable).leftJoin(assignments, eq(studentsTable.id, assignments.studentId)).where(eq(studentsTable.confirmedLearner, true));
        const roles = new Map((await tx.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)).map(u => [u.id, u.role]));
        const current = existing ? await tx.select({ studentId: reviews.studentId }).from(reviews).where(eq(reviews.termId, existing.id)) : [];
        const currentIds = new Set(current.map(r => r.studentId));
        const preview = {
          totalLearners: roster.length,
          missingAccounts: roster.filter(r => roles.get(r.assignment?.learnerUserId ?? "") !== "learner").length,
          missingTutors: roster.filter(r => !TUTOR_ROLES.includes(roles.get(r.assignment?.tutorUserId ?? "") ?? "")).length,
          existingReviews: roster.filter(r => currentIds.has(r.id)).length,
          newReviews: roster.filter(r => !currentIds.has(r.id)).length,
        };
        if (input.action === "preview_term") return { message: "Publication preview: every confirmed learner will have one required review. Missing accounts and teachers do not exclude learners.", ...preview };
        const value = { academicYear: input.academicYear, term: input.term!, templateId: template.id, startDate: input.startDate, endDate: input.endDate, deadline: input.deadline };
        await tx.insert(terms).values(value).onConflictDoUpdate({ target: [terms.academicYear, terms.term], set: { startDate: value.startDate, endDate: value.endDate, deadline: value.deadline } });
        await reconcile(tx);
        await record("publish_term", `${input.academicYear} Term ${input.term}; existing reviews preserved`);
        return { message: "Term published for all confirmed learners. Existing responses and review history are unchanged.", ...preview };
      }
      fail(400, "Unsupported maintenance action");
    });
    return jsonValidated(res, MaintainTermlyIlpsResponse, result);
  } catch (error) {
    if (error instanceof IlpError) return res.status(error.status).json({ error: error.message });
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "That learner account is already linked. Reload and check the mapping." });
    throw error;
  }
});

router.get("/termly-ilps/reviews/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid review identity" });
  const rows = await reviewRows();
  const r = rows.find(r => r.review.id === id);
  if (!r) return res.status(404).json({ error: "Review not found" });
  const assigned = canView(r, req.user!);
  let supportReadOnly = false;
  if (!assigned) {
    const reason = typeof req.query.supportReason === "string" ? req.query.supportReason.trim() : "";
    if (req.user!.role !== "admin" || reason.length < 10 || reason.length > 1000) return res.status(403).json({ error: "Only the learner and assigned RG teacher can view answers. Administrator support requires a recorded reason after discussion with them." });
    await db.insert(audit).values({ actorId: req.user!.id, reviewId: id, action: "support_read", reason });
    supportReadOnly = true;
  }
  const [template] = await db.select().from(templates).where(eq(templates.id, r.review.templateId));
  const roles = await roleMap();
  return jsonValidated(res, GetTermlyIlpReviewResponse, {
    review: fullReview(r, roles), template, supportReadOnly,
    previousReviews: rows.filter(p => p.review.studentId === r.review.studentId && p.term.academicYear === r.term.academicYear && p.term.term < r.term.term).map(p => fullReview(p, roles)),
  });
});

router.post("/termly-ilps/reviews/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid review identity" });
  const parsed = ActOnTermlyIlpReviewBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid review command" });
  const input = parsed.data;
  try {
    await db.transaction(async tx => {
      // Shared maintenance lock keeps account/tutor remapping atomic with a save.
      await maintenanceLock(tx);
      const [review] = await tx.select().from(reviews).where(eq(reviews.id, id)).for("update");
      if (!review) fail(404, "Review not found");
      const [assignment] = await tx.select().from(assignments).where(eq(assignments.studentId, review.studentId));
      const [student] = await tx.select().from(studentsTable).where(eq(studentsTable.id, review.studentId));
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
      if (!student?.confirmedLearner || !user || (user.role === "learner" ? assignment?.learnerUserId !== user.id : !TUTOR_ROLES.includes(user.role) || assignment?.tutorUserId !== user.id)) fail(403, "Only the learner and assigned RG teacher can change this review");
      if (!reviewActionAllowed(user.role, review.status, input.action)) fail(409, "This action is not available in the current review state");
      if (!Number.isInteger(input.revision) || input.revision !== review.revision) fail(409, "This review changed in another session. Your work has not been saved. Reload the current review before trying again.");
      const event = { actorId: user.id, action: input.action, at: new Date().toISOString() };
      const patch: Partial<typeof reviews.$inferInsert> = { revision: review.revision + 1, updatedAt: new Date(), history: [...review.history, event] };
      if (user.role === "learner") {
        if ("teacherComment" in req.body || "reviewDate" in req.body) fail(403, "Teacher comments and the review date are teacher-only");
        const [term] = await tx.select().from(terms).where(eq(terms.id, review.termId));
        if (today() < term.startDate) fail(409, "This term has not opened yet");
        if (!input.work) fail(400, "Saved responses and targets are required");
        const [template] = await tx.select().from(templates).where(eq(templates.id, review.templateId));
        const errors = validateWork(input.work, template.content, input.action === "submit");
        const previous = await tx.select({ id: reviews.id, work: reviews.work }).from(reviews).innerJoin(terms, eq(reviews.termId, terms.id)).where(and(eq(reviews.studentId, student.id), eq(terms.academicYear, term.academicYear), sql`${terms.term} < ${term.term}`));
        const priorKeys = new Set(previous.flatMap(p => p.work.targets.map(t => `${p.id}:${t.category}`)));
        if (Object.keys(input.work.priorTargetUpdates).some(k => !priorKeys.has(k))) errors.push("Prior target updates must refer to your earlier term targets.");
        if (Object.values(input.work.priorTargetUpdates).some(v => v.progress.length > 10000)) errors.push("Prior target update exceeds the permitted size.");
        if (errors.length) fail(400, errors.join("\n"));
        if (input.action === "submit") {
          const [tutor] = assignment?.tutorUserId ? await tx.select().from(usersTable).where(eq(usersTable.id, assignment.tutorUserId)) : [];
          if (!tutor || !TUTOR_ROLES.includes(tutor.role)) fail(409, "Ask an administrator to assign an RG teacher before submitting. You can still save your draft.");
        }
        patch.work = input.work;
        patch.status = input.action === "submit" ? "submitted" : review.status === "returned" ? "returned" : "draft";
      } else {
        if ("work" in req.body) fail(403, "Learner responses cannot be edited by teachers");
        if (input.teacherComment === undefined || input.teacherComment.length > 10000) fail(400, "Teacher comment is required and must be at most 10000 characters");
        if (input.reviewDate !== undefined && input.reviewDate !== null && !calendarDate(input.reviewDate)) fail(400, "Use a valid calendar review date");
        if (input.action === "complete" && (!input.teacherComment.trim() || !input.reviewDate)) fail(400, "Add a teacher comment and review date before completing");
        if (input.action === "return" && !input.teacherComment.trim()) fail(400, "Explain what the learner should revise");
        patch.teacherComment = input.teacherComment;
        patch.reviewDate = input.reviewDate === undefined ? review.reviewDate : input.reviewDate;
        patch.status = input.action === "complete" ? "reviewed" : input.action === "return" ? "returned" : "submitted";
        patch.history = [...review.history, { ...event, comment: input.teacherComment }];
      }
      await tx.update(reviews).set(patch).where(and(eq(reviews.id, id), eq(reviews.revision, input.revision)));
    });
    const row = (await reviewRows()).find(r => r.review.id === id)!;
    return jsonValidated(res, ActOnTermlyIlpReviewResponse, fullReview(row, await roleMap()));
  } catch (error) {
    if (error instanceof IlpError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

export default router;