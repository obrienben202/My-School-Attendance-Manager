import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHarness } from "./harness.mjs";
import { buildSchema, project } from "../tools/build.mjs";
import { prepareImport } from "../tools/prepare-import.mjs";

test("every legacy table is mapped and deployment functions remain private", () => {
  const schema = buildSchema();
  assert.equal(Object.values(schema).filter(s => s.sourceTable).length, 26);
  assert.ok(!schema.AccountMappings.fields.some(f => f.key === "passwordHash"));
  assert.equal(schema.AttendanceMarks.fields.find(f => f.key === "studentId").type, "text");
  for (const file of readdirSync(join(project, "src")).filter(f => f.endsWith(".gs"))) {
    const code = readFileSync(join(project, "src", file), "utf8"); new vm.Script(code);
    for (const match of code.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)) assert.ok(["doGet", "portalRpc"].includes(match[1]) || match[1].endsWith("_"), `Exposed function ${match[1]}`);
  }
});
test("learner account cannot claim admin, read other learners, staff records or raw identity fields", () => {
  const h = createHarness(), token = h.login("synthetic-one");
  const boot = h.rpc("bootstrap", token).data;
  assert.equal(boot.user.role, "learner"); // Synthetic verifier deliberately lies about role.
  assert.ok(!boot.modules.some(m => m.id === "SafeguardingNotes"));
  assert.equal(h.rpc("get", token, { entity: "Students", id: "s2" }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("get", token, { entity: "Operations", id: "x" }).error.code, "FORBIDDEN");
  const student = h.rpc("get", token, { entity: "Students", id: "s1" }).data;
  assert.ok(!("postCode" in student));
  assert.equal(h.rpc("list", token, { entity: "Students", search: "PRIVATE-SYNTHETIC" }).data.total, 0);
  assert.equal(h.rpc("get", token, { entity: "TermlyReviews", id: "review1" }).data.teacherComment, undefined);
});
test("invalid credentials, removed accounts, changed roles, mismatched person codes and expired sessions fail closed", () => {
  const h = createHarness();
  assert.equal(h.rpc("login", null, { username: "synthetic-admin", password: "wrong", audience: "staff" }).error.code, "AUTH");
  const token = h.login("synthetic-admin");
  h.state.sources["staff:synthetic-admin"].role = "staff";
  assert.equal(h.rpc("bootstrap", token).error.code, "AUTH");
  h.state.sources["staff:synthetic-admin"].role = "admin";
  h.data.SessionRecords[0].expiresAt = "2000-01-01T00:00:00.000Z";
  assert.equal(h.rpc("bootstrap", token).error.code, "AUTH");
  h.state.sources["learner:synthetic-one"].personCode = "PC-s2";
  assert.throws(() => h.login("synthetic-one"), /AUTH/);
  const t = h.login("synthetic-other"); delete h.state.sources["staff:synthetic-other"];
  assert.equal(h.rpc("dashboard", t).error.code, "AUTH");
});
test("teacher and department scopes use explicit links, not display names", () => {
  const h = createHarness(), t = h.login("synthetic-teacher"), hod = h.login("synthetic-hod"), other = h.login("synthetic-other");
  assert.equal(h.rpc("list", t, { entity: "Courses" }).data.total, 1);
  assert.equal(h.rpc("get", t, { entity: "Courses", id: "c2" }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("list", hod, { entity: "Students" }).data.rows[0].id, "s1");
  h.data.Courses[1].staffName = "Synthetic synthetic-teacher";
  assert.equal(h.rpc("get", t, { entity: "Courses", id: "c2" }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("get", other, { entity: "TermlyReviews", id: "review1" }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("addStaffComment", other, { reviewId: "review1", comment: "Synthetic shared comment" }).ok, true);
  assert.equal(h.rpc("get", other, { entity: "TermlyReviews", id: "review1" }).error.code, "NOT_FOUND");
});
test("register writes persist, deduplicate retries, reject tampering and preserve concurrent drafts", () => {
  const h = createHarness(), token = h.login("synthetic-teacher");
  const payload = { scheduleId: "lesson1", date: "2026-11-23", expectedRevision: 0, marks: [{ studentId: "s1", status: "Present", notes: "=HYPERLINK(\"x\")" }] };
  assert.equal(h.rpc("submitRegister", token, { ...payload, marks: [{ studentId: "s2", status: "Absent" }] }).error.code, "VALIDATION");
  const saved = h.rpc("submitRegister", token, payload, "register-retry-001");
  assert.equal(saved.ok, true, JSON.stringify(saved.error));
  assert.deepEqual(h.rpc("submitRegister", token, payload, "register-retry-001"), saved);
  assert.equal(h.data.AttendanceMarks.length, 1);
  assert.equal(h.data.RegisterAudit.length, 1);
  const conflict = h.rpc("submitRegister", token, payload);
  assert.equal(conflict.error.code, "CONFLICT"); assert.equal(conflict.error.details.current._revision, 1);
  assert.equal(h.data.AttendanceMarks[0].status, "Present");
  assert.equal(h.rpc("register", token, { scheduleId: "lesson2", date: "2026-11-23" }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("register", token, { scheduleId: "lesson1", date: "2026-11-24" }).error.code, "VALIDATION");
});
test("interrupted multi-tab register save recovers once and does not falsely report success", () => {
  const h = createHarness(), token = h.login("synthetic-teacher");
  const payload = { scheduleId: "lesson1", date: "2026-11-23", expectedRevision: 0, marks: [{ studentId: "s1", status: "Late", notes: "" }] };
  h.state.failEntity = "DailyRegisters";
  const failed = h.rpc("submitRegister", token, payload, "recover-register-001");
  assert.equal(failed.error.code, "INCOMPLETE_OPERATION");
  assert.equal(h.data.Operations[0].status, "prepared");
  assert.equal(h.rpc("submitRegister", token, payload, "recover-register-001").ok, true);
  assert.equal(h.data.Operations[0].status, "committed");
  assert.equal(h.data.AttendanceMarks.length, 1); assert.equal(h.data.RegisterAudit.length, 1);
  assert.equal(h.data.AuditLog.length, 1);
});
test("retired courses, missing schedules, unrecorded Week A/B calendars and invalid dates do not invent lessons", () => {
  const h = createHarness(), token = h.login("synthetic-teacher");
  h.data.LessonSchedules[0].weekPattern = "Week A";
  assert.equal(h.rpc("register", token, { scheduleId: "lesson1", date: "2026-11-23" }).error.code, "VALIDATION");
  h.put("CalendarWeeks", { id: "week1", weekStart: "2026-11-23", pattern: "Week A" });
  assert.equal(h.rpc("register", token, { scheduleId: "lesson1", date: "2026-11-23" }).ok, true);
  h.data.LessonSchedules[0].day = null;
  assert.equal(h.rpc("register", token, { scheduleId: "lesson1", date: "2026-11-23" }).error.code, "VALIDATION");
  h.data.Courses[0].isActive = false;
  assert.equal(h.rpc("dashboard", token).data.counts.find(c => c.label === "Courses").value, 0);
  assert.throws(() => h.context.dateOnly_("2026-02-30"));
  assert.equal(h.context.dateOnly_("2026-10-25"), "2026-10-25");
});
test("learner review saves only own answers, validates full template and becomes read-only after submission", () => {
  const h = createHarness(), one = h.login("synthetic-one"), two = h.login("synthetic-two");
  const payload = { id: "review1", expectedRevision: 1, submit: true, work: { answers: {}, summary: "", targets: [], priorTargetUpdates: {} } };
  assert.equal(h.rpc("saveLearnerReview", two, payload).error.code, "NOT_FOUND");
  assert.equal(h.rpc("saveLearnerReview", one, payload).error.code, "VALIDATION");
  payload.work.answers.q1 = "Synthetic reflection";
  payload.work.summary = "Synthetic discussion";
  payload.work.targets = ["academic", "personal", "future"].map(category => ({ category, description: "Synthetic goal", steps: "Synthetic action", progress: "", completed: false }));
  const saved = h.rpc("saveLearnerReview", one, payload);
  assert.equal(saved.ok, true, JSON.stringify(saved.error)); assert.equal(saved.data.status, "submitted");
  assert.equal(h.data.TermlyReviews[0].teacherComment, "PRIVATE-UNRELEASED");
  assert.equal(h.rpc("saveLearnerReview", one, { ...payload, expectedRevision: 2 }).error.code, "FORBIDDEN");
});
test("generic edits validate foreign keys, preserve revisions and prevent readonly identity changes", () => {
  const h = createHarness(), admin = h.login("synthetic-admin");
  assert.equal(h.rpc("save", admin, { entity: "StudentEnrolments", record: { studentId: "missing", courseId: "c1" } }).error.code, "VALIDATION");
  const saved = h.rpc("save", admin, { entity: "Courses", record: { code: "SYN-NEW", name: "Synthetic New Course" } });
  assert.equal(saved.ok, true, JSON.stringify(saved.error));
  assert.equal(h.rpc("save", admin, { entity: "Courses", record: { id: saved.data.id, name: "Changed" }, expectedRevision: 0 }).error.code, "CONFLICT");
  assert.equal(h.rpc("save", admin, { entity: "Courses", record: { id: saved.data.id, createdAt: "bad" }, expectedRevision: 1 }).error.code, "FORBIDDEN");
  assert.equal(h.rpc("remove", admin, { entity: "Courses", id: "c1", expectedRevision: 1 }).error.code, "VALIDATION");
});
test("file bytes are validated, private, permission checked and never served by a public Drive link", () => {
  const h = createHarness(), admin = h.login("synthetic-admin"), one = h.login("synthetic-one"), two = h.login("synthetic-two");
  const request = { entity: "Students", id: "s1", name: "synthetic.pdf", mimeType: "application/pdf", base64: Buffer.from("%PDF-synthetic-only").toString("base64") };
  const upload = h.rpc("upload", admin, request, "file-upload-001");
  assert.equal(upload.ok, true, JSON.stringify(upload.error)); assert.ok(!upload.data.driveFileId);
  assert.equal(h.rpc("upload", admin, request, "file-upload-001").ok, true); assert.equal(h.state.files.size, 1);
  assert.equal(h.rpc("download", two, { id: upload.data.id }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("download", one, { id: upload.data.id }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("files", one, { entity: "Students", id: "s1" }).data.length, 0);
  assert.equal(h.rpc("download", h.login("synthetic-teacher"), { id: upload.data.id }).error.code, "NOT_FOUND");
  assert.equal(h.rpc("download", admin, { id: upload.data.id }).data.base64, request.base64);
  const photo = { ...request, name: "synthetic.png", mimeType: "image/png", base64: Buffer.from([137,80,78,71,13,10,26,10]).toString("base64") };
  const uploadedPhoto = h.rpc("upload", admin, photo);
  assert.equal(uploadedPhoto.ok, true);
  assert.equal(h.rpc("download", one, { id: uploadedPhoto.data.id }).data.base64, photo.base64);
  const alternateEncoding = h.rpc("upload", admin, { ...photo, base64: photo.base64.replace(/=+$/, "") });
  assert.equal(h.rpc("download", one, { id: alternateEncoding.data.id }).data.base64, photo.base64);
  assert.equal(h.rpc("upload", admin, { ...request, base64: Buffer.from("<script>bad</script>").toString("base64") }).error.code, "VALIDATION");
});
test("formula-like cells round trip without being executable; private table access and rate overload fail closed", () => {
  const h = createHarness();
  for (const value of ["=SUM(A1)", "+cmd", "-cmd", "@cmd", "~p:literal", "ordinary"]) assert.equal(h.context.decodeCell_(h.context.encodeCell_(value, { type: "text" }), { type: "text" }), value);
  h.state.busy = true;
  assert.equal(h.rpc("bootstrap", "x").error.code, "BUSY");
  h.state.busy = false;
  for (let i = 0; i < 6; i++) h.rpc("login", null, { username: "unknown", password: "wrong", audience: "staff" });
  assert.equal(h.rpc("login", null, { username: "unknown", password: "wrong", audience: "staff" }).error.code, "BUSY");
});
test("offline import drops credentials explicitly, orders dependencies, and dry run never writes", () => {
  const prepared = prepareImport({ students: [{ id: 10, person_code: "SYN-10", forename: "Synthetic", surname: "Import", created_at: "2026-11-21T12:00:00.000Z" }], users: [{ id: "old-user", username: "synthetic", password_hash: "never-export-this", role: "staff" }], sessions: [{ sid: "synthetic-token" }] });
  assert.ok(prepared.report.omissions.length >= 2);
  assert.ok(!JSON.stringify(prepared.batches).includes("never-export-this"));
  const h = createHarness(), before = JSON.stringify(h.data);
  const checked = h.context.importPlan_(new h.MemoryStore(), prepared.batches[0]);
  assert.equal(checked.ready, true, JSON.stringify(checked.issues));
  assert.equal(JSON.stringify(h.data), before);
  assert.throws(() => prepareImport({ students: [{ id: 10, invented_field: "no silent loss" }] }), /Unmapped/);
});
