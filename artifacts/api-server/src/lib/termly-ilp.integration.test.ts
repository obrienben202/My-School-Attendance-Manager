import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { db, studentsTable, usersTable, ilpTemplatesTable, ilpTermsTable, ilpReviewsTable, ilpSupportAuditTable, sessionsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import app from "../app";
import { syncUsersFromDirectory } from "./user-directory";
import { PDF_ILP_TEMPLATES } from "./ilp-pdf-templates";
import type { TermlyIlpDetail, TermlyIlpAdmin, TermlyIlpWork } from "@workspace/api-zod";

// Opt in: this suite uses synthetic directory and roster fixtures in DEVELOPMENT.
// The school's GAS password verifier is a controlled boundary, never bypassed in
// runtime code. The real /login, sessions, directory roles and routers run here.
test("termly ILP HTTP integration: verified login, ownership, lifecycle, reconciliation and versioning", {
  skip: process.env.RUN_ILP_INTEGRATION !== "1",
  timeout: 120000,
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.ok(!process.env.REPLIT_DEPLOYMENT);
  const token = randomUUID().replaceAll("-", "");
  const prefix = `ilp-fixture-${token}`;
  const fixtureNames = ["admin", "learner1", "learner2", "unlinked", "tutor", "other", "office", "hod"] as const;
  const passwords = new Map(fixtureNames.map(name => [`${prefix}-${name}`, randomUUID()]));
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    if (String(input).startsWith("https://script.google.com/macros/")) {
      const form = new URLSearchParams(String(init?.body));
      const success = passwords.get(form.get("username") ?? "") === form.get("password");
      // Deliberately malicious role claim demonstrates GAS cannot elevate.
      return new Response(JSON.stringify({ success, role: "admin", fullName: "Synthetic ILP fixture" }), { status: 200 });
    }
    return nativeFetch(input, init);
  }) as typeof fetch;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  let fixtureUsers: typeof usersTable.$inferSelect[] = [];
  const studentIds: number[] = [];
  const templateIds: number[] = [];
  const year = "2998-2999";
  const nextYear = "2999-3000";
  async function request(path: string, cookie: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    // Error payloads intentionally differ from successful generated contracts.
    return { status: response.status, data: await response.json() as any, response };
  }
  try {
    const csv = "username,password,role,fullname\n" + fixtureNames.map(name => {
      const role = name.startsWith("learner") || name === "unlinked" ? "student" : name === "tutor" || name === "other" ? "staff" : name;
      return `${prefix}-${name},${passwords.get(`${prefix}-${name}`)},${role},Synthetic ILP fixture`;
    }).join("\n");
    assert.equal((await syncUsersFromDirectory(csv)).invalid, 0);
    fixtureUsers = await db.select().from(usersTable).where(inArray(usersTable.username, fixtureNames.map(name => `${prefix}-${name}`)));
    function uid(name: typeof fixtureNames[number]) { return fixtureUsers.find(u => u.username === `${prefix}-${name}`)!.id; }
    const cookies = new Map<string, string>();
    for (const name of fixtureNames) {
      const login = await request("/login", "", "POST", { username: `${prefix}-${name}`, password: passwords.get(`${prefix}-${name}`) });
      assert.equal(login.status, 200);
      cookies.set(name, login.response.headers.get("set-cookie")!.split(";")[0]);
      const me = await request("/auth/user", cookies.get(name)!);
      assert.equal(me.data.user.role, name.startsWith("learner") || name === "unlinked" ? "learner" : name === "tutor" || name === "other" ? "staff" : name);
    }
    const admin = cookies.get("admin")!;
    const learner = cookies.get("learner1")!;
    const second = cookies.get("learner2")!;
    const tutor = cookies.get("tutor")!;
    const other = cookies.get("other")!;
    for (let i = 1; i <= 2; i++) {
      const [student] = await db.insert(studentsTable).values({ personCode: `${prefix}-person-${i}`, forename: "Synthetic", surname: `Fixture ${i}`, confirmedLearner: true }).returning();
      studentIds.push(student.id);
      assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "assign", personCode: student.personCode, learnerUserId: uid(i === 1 ? "learner1" : "learner2"), tutorUserId: uid("tutor") })).status, 200);
    }
    assert.equal((await request("/termly-ilps", cookies.get("unlinked")!)).data.linked, false);
    assert.deepEqual((await request("/termly-ilps", cookies.get("unlinked")!)).data.reviews, []);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "assign", personCode: `${prefix}-person-2`, learnerUserId: uid("learner1"), tutorUserId: uid("tutor") })).status, 409);
    assert.equal((await request("/termly-ilps/admin", learner, "POST", { action: "reconcile" })).status, 403);
    for (let i = 0; i < 3; i++) {
      const [template] = await db.insert(ilpTemplatesTable).values({ term: i + 1, version: 900000 + i, content: PDF_ILP_TEMPLATES[i], createdBy: uid("admin") }).returning();
      templateIds.push(template.id);
      assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_template", templateId: template.id, revision: 0 })).status, 200);
    }
    const publication = { academicYear: year, term: 1, templateId: templateIds[0], startDate: "2020-01-01", endDate: "2020-12-31", deadline: "2020-04-01" };
    const preview = await request("/termly-ilps/admin", admin, "POST", { action: "preview_term", ...publication });
    assert.equal(preview.status, 200);
    assert.ok(preview.data.totalLearners >= 2);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_term", ...publication })).status, 200);
    const list = await request("/termly-ilps", learner);
    const r1 = list.data.reviews.find((r: { academicYear: string }) => r.academicYear === year);
    const r2 = (await request("/termly-ilps", second)).data.reviews.find((r: { academicYear: string }) => r.academicYear === year);
    assert.equal(r1.status, "not_started");
    assert.equal(r1.overdue, true);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, second)).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, other)).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, admin)).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, cookies.get("hod")!)).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}?supportReason=Discussed%20with%20learner%20and%20RG%20teacher`, admin)).status, 200);
    assert.ok((await db.select().from(ilpSupportAuditTable).where(eq(ilpSupportAuditTable.reviewId, r1.id))).length > 0);
    const detail = (await request(`/termly-ilps/reviews/${r1.id}`, learner)).data as TermlyIlpDetail;
    const draft: TermlyIlpWork = { answers: {}, summary: "", targets: [], priorTargetUpdates: {} };
    const firstQuestion = detail.template.content.sections[0].questions[0].id;
    draft.answers[firstQuestion] = "Saved fixture response";
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "save", revision: 0, work: draft })).status, 200);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner)).data.review.work.answers[firstQuestion], "Saved fixture response");
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "save", revision: 0, work: draft })).status, 409);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, second, "POST", { action: "save", revision: 1, work: draft })).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "submit", revision: 1, work: draft })).status, 400);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner)).data.review.revision, 1);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "save", revision: 1, work: draft, teacherComment: "tamper" })).status, 403);
    const ready: TermlyIlpWork = {
      answers: Object.fromEntries(detail.template.content.sections.flatMap(s => s.questions).map(q => [q.id, "Discuss with my RG teacher"])),
      summary: "Synthetic discussion summary",
      targets: (["academic", "personal", "future"] as const).map(category => ({ category, description: `${category} fixture goal`, steps: "Meet teacher, agree a weekly step.", progress: "", completed: false })),
      priorTargetUpdates: {},
    };
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "submit", revision: 1, work: ready })).status, 200);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "save", revision: 2, work: draft })).status, 409);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, other, "POST", { action: "complete", revision: 2, teacherComment: "tamper", reviewDate: "2026-10-02" })).status, 403);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, tutor, "POST", { action: "complete", revision: 2, teacherComment: "", reviewDate: null })).status, 400);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, tutor, "POST", { action: "return", revision: 2, teacherComment: "Please revise your summary.", reviewDate: null })).status, 200);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, learner, "POST", { action: "submit", revision: 3, work: ready })).status, 200);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, tutor, "POST", { action: "complete", revision: 4, teacherComment: "Reviewed fixture goals.", reviewDate: "2026-10-02" })).status, 200);
    const reviewed = (await request(`/termly-ilps/reviews/${r1.id}`, learner)).data.review;
    assert.equal(reviewed.status, "reviewed");
    assert.equal(reviewed.reviewDate, "2026-10-02");
    assert.equal(reviewed.history.length, 5);
    // Logout invalidates the old cookie, sign back in through the real route.
    await request("/logout", learner, "POST");
    assert.equal((await request("/termly-ilps", learner)).status, 401);
    const loginAgain = await request("/login", "", "POST", { username: `${prefix}-learner1`, password: passwords.get(`${prefix}-learner1`) });
    const resumed = loginAgain.response.headers.get("set-cookie")!.split(";")[0];
    for (let n = 0; n < 3; n++) assert.deepEqual((await request(`/termly-ilps/reviews/${r1.id}`, resumed)).data.review.work, ready);
    assert.equal((await request(`/termly-ilps/reviews/${r2.id}`, resumed)).status, 403);
    // Every old staff router, including legacy ILPs and storage, is excluded.
    for (const path of ["/dashboard/summary", "/students", "/courses", "/attendance", "/targets", "/ilps", "/schedule", "/assessments", "/concierge/applicants", "/eprogressions", "/sync/students", "/hod/timetable", "/staff", "/planned-absences", "/safeguarding/notes", "/storage", "/reports/attendance", "/admin/users", "/admin/sync-users"]) {
      assert.equal((await request(path, resumed)).status, 403, path);
    }
    assert.equal((await request("/ilps", tutor)).status, 200);
    assert.equal((await request("/admin/users", tutor)).status, 403);
    // Repeated publication preserves ID, work, history; new versions cannot
    // silently replace an already opened term.
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_term", ...publication })).status, 200);
    assert.deepEqual((await request(`/termly-ilps/reviews/${r1.id}`, resumed)).data.review.work, ready);
    const clone = await request("/termly-ilps/admin", admin, "POST", { action: "clone_template", templateId: templateIds[0] });
    assert.equal(clone.status, 200);
    templateIds.push(clone.data.templateId);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "save_template", templateId: clone.data.templateId, revision: 0, content: { ...detail.template.content, title: "Future version fixture" } })).status, 200);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "save_template", templateId: clone.data.templateId, revision: 0, content: detail.template.content })).status, 409);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_template", templateId: clone.data.templateId, revision: 1 })).status, 200);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_term", ...publication, templateId: clone.data.templateId })).status, 409);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, resumed)).data.template.content.title, PDF_ILP_TEMPLATES[0].title);
    const [late] = await db.insert(studentsTable).values({ personCode: `${prefix}-late`, forename: "Synthetic", surname: "Late", confirmedLearner: false }).returning();
    studentIds.push(late.id);
    await db.update(studentsTable).set({ confirmedLearner: true }).where(eq(studentsTable.id, late.id));
    const lateReviews = await db.select().from(ilpReviewsTable).innerJoin(ilpTermsTable, eq(ilpReviewsTable.termId, ilpTermsTable.id)).where(eq(ilpReviewsTable.studentId, late.id));
    assert.equal(lateReviews.filter(r => r.ilp_review_terms.academicYear === year).length, 1);
    const overview = (await request("/termly-ilps/admin", admin)).data as TermlyIlpAdmin;
    const lateReview = overview.reviews.find(r => r.studentId === late.id && r.academicYear === year)!;
    assert.equal(lateReview.accountLinked, false);
    assert.equal(lateReview.tutorAssigned, false);
    assert.equal("work" in lateReview, false);
    // Later term summaries and prior progress are copied into the CURRENT work.
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_term", ...publication, term: 2, templateId: templateIds[1] })).status, 200);
    const term2 = (await request("/termly-ilps", resumed)).data.reviews.find((r: { academicYear: string; term: number }) => r.academicYear === year && r.term === 2);
    const term2Detail = (await request(`/termly-ilps/reviews/${term2.id}`, resumed)).data;
    assert.equal(term2Detail.previousReviews[0].work.summary, ready.summary);
    const nextWork = { ...draft, answers: {}, priorTargetUpdates: { [`${r1.id}:academic`]: { progress: "Agreed step completed", completed: true } } };
    assert.equal((await request(`/termly-ilps/reviews/${term2.id}`, resumed, "POST", { action: "save", revision: 0, work: nextWork })).status, 200);
    assert.equal((await request(`/termly-ilps/reviews/${r1.id}`, resumed)).data.review.work.targets[0].completed, false);
    assert.equal((await request("/termly-ilps/admin", admin, "POST", { action: "publish_term", ...publication, academicYear: nextYear, templateId: clone.data.templateId })).status, 200);
    const rollover = (await request("/termly-ilps", resumed)).data.reviews.find((r: { academicYear: string }) => r.academicYear === nextYear);
    assert.equal(rollover.status, "not_started");
    assert.notEqual(rollover.id, r1.id);
    // Current database role, not session snapshot, wins on every request.
    await db.update(usersTable).set({ role: "unknown" }).where(eq(usersTable.id, uid("learner2")));
    assert.equal((await request("/termly-ilps", second)).status, 401);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const termRows = await db.select({ id: ilpTermsTable.id }).from(ilpTermsTable).where(inArray(ilpTermsTable.academicYear, [year, nextYear]));
    if (termRows.length) {
      await db.delete(ilpReviewsTable).where(inArray(ilpReviewsTable.termId, termRows.map(t => t.id)));
      await db.delete(ilpTermsTable).where(inArray(ilpTermsTable.id, termRows.map(t => t.id)));
    }
    if (studentIds.length) await db.delete(studentsTable).where(inArray(studentsTable.id, studentIds));
    if (templateIds.length) await db.delete(ilpTemplatesTable).where(inArray(ilpTemplatesTable.id, templateIds));
    const ids = fixtureUsers.map(u => u.id);
    if (ids.length) {
      await db.delete(ilpSupportAuditTable).where(inArray(ilpSupportAuditTable.actorId, ids));
      await db.delete(sessionsTable).where(sql`${sessionsTable.sess}->'user'->>'id' IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      await db.delete(usersTable).where(inArray(usersTable.id, ids));
    }
  }
});