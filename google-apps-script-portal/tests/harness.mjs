import vm from "node:vm";
import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildSchema, project } from "../tools/build.mjs";

// SYNTHETIC ONLY. Never included in the Apps Script deployment folder.
export function createHarness() {
  const schema = buildSchema(), data = Object.fromEntries(Object.keys(schema).map(k => [k, []]));
  const state = { failEntity: null, busy: false, sources: {}, files: new Map() };
  const properties = { MASTER_WORKBOOK_ID: "synthetic-workbook", SESSION_KEY: "synthetic-only-key-not-an-environment-secret", MODE: "TEST", STAFF_AUTH_URL: "https://script.google.com/macros/s/SYNTHETIC_ONLY/exec", LEARNER_AUTH_URL: "https://script.google.com/macros/s/SYNTHETIC_ONLY/exec", UPLOAD_FOLDER_ID: "synthetic-folder" };
  const caches = new Map();
  const utilities = {
    getUuid: () => crypto.randomUUID(), Charset: { UTF_8: "utf8" }, DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_, value) => [...crypto.createHash("sha256").update(String(value)).digest()],
    computeHmacSha256Signature: (value, key) => [...crypto.createHmac("sha256", key).update(value).digest()],
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString("base64url"),
    base64Encode: bytes => Buffer.from(bytes).toString("base64"),
    base64Decode: text => [...Buffer.from(text, "base64")],
    formatDate: (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date),
    newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
  };
  function fakeFile(blob) {
    const id = crypto.randomUUID(); let trashed = false;
    const file = { getId: () => id, getName: () => blob.name, getMimeType: () => blob.mime,
      getSize: () => blob.bytes.length, getSharingAccess: () => "PRIVATE", getEditors: () => [], getViewers: () => [],
      getBlob: () => ({ getBytes: () => blob.bytes }), isTrashed: () => trashed, setTrashed: value => { trashed = value; },
      getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return { getId: () => "synthetic-folder" }; } }; } };
    state.files.set(id, file); return file;
  }
  const context = vm.createContext({
    console, Date, JSON, Math, Set, Map, Number, String, Boolean, Array, Object,
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...properties }), setProperties: p => Object.assign(properties, p) }) },
    Utilities: utilities,
    CacheService: { getScriptCache: () => ({ get: k => caches.get(k), put: (k, v) => caches.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !state.busy, releaseLock: () => {} }) },
    UrlFetchApp: { fetch: (_url, options) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ success: options.payload.password === "Synthetic-only-42", role: "admin" }) }) },
    DriveApp: { Access: { PRIVATE: "PRIVATE" }, getFolderById: () => ({ getId: () => "synthetic-folder", getSharingAccess: () => "PRIVATE", getEditors: () => [], getViewers: () => [], createFile: fakeFile }),
      getFileById: id => { if (!state.files.has(id)) throw new Error("Missing synthetic file"); return state.files.get(id); } },
  });
  vm.runInContext(`var PortalSchema = ${JSON.stringify(schema)};`, context);
  const sourceDir = join(project, "src");
  for (const file of readdirSync(sourceDir).filter(f => f.endsWith(".gs"))) vm.runInContext(readFileSync(join(sourceDir, file), "utf8"), context, { filename: file });
  const RealSheetStore = context.SheetStore_;
  function MemoryStore() { this.cache = {}; }
  MemoryStore.prototype.rows = function(entity) { return this.cache[entity] ||= structuredClone(data[entity]); };
  MemoryStore.prototype.put = function(entity, record) {
    if (state.failEntity === entity) { state.failEntity = null; throw new Error("Synthetic interrupted Google write"); }
    const rows = data[entity], index = rows.findIndex(r => String(r.id) === String(record.id));
    const value = structuredClone(record);
    if (index >= 0) rows[index] = value; else rows.push(value);
    this.cache[entity] = structuredClone(rows);
  };
  context.SheetStore_ = MemoryStore;
  context.directoryRecord_ = (audience, username, withHash) => {
    const source = state.sources[`${audience}:${username}`];
    if (!source || !source.active) context.failure_("AUTH", "Invalid account or password.");
    return structuredClone(source);
  };
  const put = (entity, record) => {
    const row = { ...structuredClone(record), _revision: record._revision || 1, _deleted: false, _updatedAt: new Date().toISOString() };
    data[entity].push(row); return row;
  };
  const addActor = (username, role, studentId = null, department = "Synthetic Science") => {
    state.sources[`${role === "learner" ? "learner" : "staff"}:${username}`] = { username, role, displayName: "Synthetic " + username, active: true, personCode: studentId ? `PC-${studentId}` : null, department };
    return put("AccountMappings", { id: username, username, role, audience: role === "learner" ? "learner" : "staff", studentId, active: true });
  };
  put("Students", { id: "s1", personCode: "PC-s1", forename: "Synthetic", surname: "Learner One", yearGroup: "9", confirmedLearner: true, postCode: "PRIVATE-SYNTHETIC" });
  put("Students", { id: "s2", personCode: "PC-s2", forename: "Synthetic", surname: "Learner Two", yearGroup: "10" });
  put("Courses", { id: "c1", code: "SYN-SCI", name: "Synthetic Science", isActive: true });
  put("Courses", { id: "c2", code: "SYN-ART", name: "Synthetic Art", isActive: true });
  put("StudentEnrolments", { id: "e1", studentId: "s1", courseId: "c1", status: "Enrolled" });
  put("StudentEnrolments", { id: "e2", studentId: "s2", courseId: "c2", status: "Enrolled" });
  put("LessonSchedules", { id: "lesson1", courseId: "c1", day: "Monday", startTime: "09:00", endTime: "10:00", weekPattern: "Every week", isActive: true });
  put("LessonSchedules", { id: "lesson2", courseId: "c2", day: "Monday", startTime: "10:00", endTime: "11:00", weekPattern: "Every week", isActive: true });
  addActor("synthetic-admin", "admin"); addActor("synthetic-teacher", "staff");
  addActor("synthetic-other", "staff"); addActor("synthetic-hod", "hod");
  addActor("synthetic-office", "office"); addActor("synthetic-one", "learner", "s1", null); addActor("synthetic-two", "learner", "s2", null);
  put("CourseAccess", { id: "access1", username: "synthetic-teacher", courseId: "c1", canEdit: true });
  put("CourseAccess", { id: "access2", username: "synthetic-other", courseId: "c2", canEdit: true });
  put("DepartmentCourses", { id: "dept1", department: "Synthetic Science", courseId: "c1" });
  put("ReviewTemplates", { id: "template1", term: 1, version: 1, status: "published", revision: 1, content: { title: "Synthetic term review", sections: [{ id: "section1", title: "Learning", questions: [{ id: "q1", prompt: "What went well?", required: true }] }] } });
  put("ReviewTerms", { id: "term1", academicYear: "2026/27", term: 1, templateId: "template1", startDate: "2026-09-01", endDate: "2026-12-20", deadline: "2026-12-10" });
  put("LearnerAssignments", { id: "link1", studentId: "s1", learnerUserId: "synthetic-one", tutorUserId: "synthetic-teacher" });
  put("TermlyReviews", { id: "review1", studentId: "s1", termId: "term1", templateId: "template1", status: "not_started", revision: 0, work: { answers: {}, summary: "", targets: [], priorTargetUpdates: {} }, teacherComment: "PRIVATE-UNRELEASED", history: [] });
  const rpc = (action, token, payload = {}, requestId = crypto.randomUUID()) => structuredClone(context.portalRpc({ action, token, payload, requestId }));
  const login = username => {
    const result = rpc("login", null, { username, password: "Synthetic-only-42", audience: username === "synthetic-one" || username === "synthetic-two" ? "learner" : "staff" });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    return result.data.token;
  };
  return { context, data, state, schema, properties, put, addActor, rpc, login, MemoryStore, RealSheetStore };
}
