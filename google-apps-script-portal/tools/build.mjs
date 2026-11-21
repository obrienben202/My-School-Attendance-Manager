import ts from "typescript";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

export const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(project, "..");
const names = {
  students: "Students", courses: "Courses", attendance: "AttendanceMarks",
  attendance_registers: "DailyRegisters", attendance_register_audit: "RegisterAudit",
  student_enrollments: "StudentEnrolments", enrolment_photo_uploads: "LegacyPhotoUploads",
  assessments: "Assessments", assessment_results: "AssessmentResults", users: "AccountMappings",
  sessions: "LegacySessions", schedule: "LessonSchedules", staff_timetable_slots: "StaffTimetableSlots",
  targets: "Targets", planned_absences: "PlannedAbsences", kpi_benchmarks: "KPIBenchmarks",
  ilps: "ILPs", ilp_groups: "ILPGroups", ilp_review_templates: "ReviewTemplates",
  ilp_review_terms: "ReviewTerms", ilp_learner_assignments: "LearnerAssignments",
  ilp_term_reviews: "TermlyReviews", ilp_support_audit: "ILPSupportAudit",
  safeguarding_notes: "SafeguardingNotes", eprogressions: "EProgressions",
  concierge_applications: "ConciergeApplications",
};
const label = key => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
const simple = node => {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(simple);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText().replace(/['"]/g, ""), simple(p.initializer)]));
};
export function buildSchema() {
  const tables = {};
  const variables = {};
  const folder = join(workspace, "lib/db/src/schema");
  for (const filename of readdirSync(folder).filter(f => f.endsWith(".ts"))) {
    const sf = ts.createSourceFile(filename, readFileSync(join(folder, filename), "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) &&
          node.initializer.expression.getText(sf) === "pgTable") {
        const [nameNode, fieldsNode] = node.initializer.arguments;
        const tableName = simple(nameNode);
        const id = names[tableName];
        if (!id || !ts.isObjectLiteralExpression(fieldsNode)) throw new Error(`Unmapped persisted table: ${tableName}`);
        variables[node.name.getText(sf)] = id;
        const fields = [];
        for (const prop of fieldsNode.properties.filter(ts.isPropertyAssignment)) {
          const key = prop.name.getText(sf).replace(/['"]/g, "");
          let call = prop.initializer;
          const chains = {};
          while (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)) {
            chains[call.expression.name.text] = call.arguments;
            call = call.expression.expression;
          }
          if (!ts.isCallExpression(call)) throw new Error(`Unknown column ${id}.${key}`);
          const kind = call.expression.getText(sf);
          const sourceColumn = simple(call.arguments[0]);
          const type = ({ serial: "text", integer: "number", numeric: "number", real: "number", boolean: "boolean", jsonb: "json", date: "date", timestamp: "datetime" })[kind] || "text";
          const ref = chains.references?.[0]?.getText(sf).match(/=>\s*(\w+)\.(\w+)/);
          const field = { key, label: label(key), type, integer: kind === "integer", sourceColumn, required: !!chains.notNull || !!chains.primaryKey,
            readonly: key === "id" || ["createdAt", "updatedAt", "revision", "history", "submittedBy", "submittedAt", "gradeReleasedAt", "registerMarked", "photoObjectPath", "authorUserId", "updatedBy", "updatedById", "createdById", "createdBy", "markedBy", "requestedBy"].includes(key),
            unique: !!chains.unique || !!chains.primaryKey, autoTime: !!chains.defaultNow };
          const defaultValue = simple(chains.default?.[0]);
          if (defaultValue !== undefined) field.defaultValue = type === "number" ? Number(defaultValue) : defaultValue;
          if (ref) field.referenceVariable = ref[1];
          fields.push(field);
        }
        // Sheets always persist an explicit ID first, even when SQL used a natural key.
        const naturalKey = !fields.some(f => f.key === "id") ? fields.find(f => f.unique && f.required) : null;
        if (!fields.some(f => f.key === "id")) fields.unshift({ key: "id", label: "ID", type: "text", readonly: true, required: true, unique: true });
        fields.sort((a, b) => a.key === "id" ? -1 : b.key === "id" ? 1 : 0);
        tables[id] = { id, sourceTable: tableName, fields, ...(naturalKey ? { legacyIdentityField: naturalKey.key } : {}) };
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  for (const table of Object.values(tables)) for (const field of table.fields) {
    if (field.referenceVariable) { field.references = variables[field.referenceVariable]; delete field.referenceVariable; }
  }
  // Never transfer legacy credentials or tokens into the replacement.
  tables.AccountMappings.fields = tables.AccountMappings.fields.filter(f => f.key !== "passwordHash");
  const add = (id, fields) => { tables[id] = { id, sourceTable: null, fields: [
    { key: "id", type: "text", readonly: true, label: "ID" },
    ...Object.entries(fields).map(([key, definition]) => ({ key, label: label(key), type: "text", ...definition })),
  ] }; };
  const extend = (id, fields) => tables[id].fields.push(...Object.entries(fields).map(([key, definition]) => ({ key, label: label(key), type: "text", ...definition })));
  extend("AccountMappings", { audience: { required: true, readonly: true }, studentId: { references: "Students", readonly: true }, active: { type: "boolean", readonly: true }, profile: { type: "json", readonly: true } });
  // Immutable linked usernames, never the staffName presentation field, determine access.
  extend("StaffTimetableSlots", { staffUsername: {}, department: {} });
  add("CourseAccess", { username: { required: true }, courseId: { required: true, references: "Courses" }, canEdit: { type: "boolean", defaultValue: false } });
  add("DepartmentCourses", { department: { required: true }, courseId: { required: true, references: "Courses" } });
  add("Settings", { key: { required: true, readonly: true, unique: true }, value: {} });
  add("SchemaVersions", { version: { required: true }, createdAt: { type: "datetime", readonly: true } });
  add("SessionRecords", { tokenHash: {}, accountId: {}, username: {}, audience: {}, expiresAt: { type: "datetime" }, revoked: { type: "boolean" } });
  add("AuditLog", { actorId: {}, action: {}, entity: {}, recordId: {}, at: { type: "datetime" }, operationId: {} });
  add("Operations", { actorId: {}, requestId: {}, fingerprint: {}, status: {}, plan: { type: "json" }, result: { type: "json" }, at: { type: "datetime" } });
  add("StaffComments", { reviewId: { required: true, references: "TermlyReviews" }, comment: { required: true }, authorUserId: { readonly: true }, at: { type: "datetime", readonly: true } });
  add("UploadMetadata", { entity: { required: true }, recordId: { required: true }, driveFileId: { readonly: true }, name: { required: true }, mimeType: {}, size: { type: "number" }, uploadedBy: { readonly: true }, at: { type: "datetime", readonly: true }, contentHash: { readonly: true }, legacySourcePath: { readonly: true } });
  add("MarkbookVerification", { assessmentId: { required: true, references: "Assessments" }, verified: { type: "boolean", defaultValue: false }, notes: {}, verifiedBy: { readonly: true }, at: { type: "datetime", readonly: true } });
  add("CalendarWeeks", { weekStart: { type: "date", required: true, unique: true }, pattern: { required: true } });
  add("RecordFragments", { ownerEntity: {}, ownerId: {}, field: {}, digest: {}, part: { type: "number" }, content: {} });
  // These foreign keys are implicit rather than declared by the old schema.
  const implicit = { Assessments: { courseId: "Courses" }, AssessmentResults: { assessmentId: "Assessments", studentId: "Students" }, EProgressions: { studentId: "Students", courseId: "Courses" }, ConciergeApplications: { studentId: "Students", courseId: "Courses" } };
  for (const [id, refs] of Object.entries(implicit)) for (const f of tables[id].fields) if (refs[f.key]) f.references = refs[f.key];
  for (const table of Object.values(tables)) for (const field of table.fields) if (field.references) field.type = "text";
  return tables;
}

export function build() {
  const out = join(workspace, "generated-artifacts/google-portal");
  const app = join(out, "apps-script");
  mkdirSync(app, { recursive: true });
  const schema = buildSchema();
  writeFileSync(join(app, "Schema.gs"), `// Generated from the persisted school schema; no school records included.\nvar PortalSchema = ${JSON.stringify(schema, null, 2)};\n`);
  for (const file of readdirSync(join(project, "src"))) copyFileSync(join(project, "src", file), join(app, file));
  const require = createRequire(join(workspace, "artifacts/api-server/package.json"));
  const bcryptEntry = require.resolve("bcryptjs");
  copyFileSync(bcryptEntry, join(app, "Bcrypt.gs"));
  copyFileSync(resolve(dirname(bcryptEntry), "../LICENSE"), join(out, "BCRYPT-LICENSE"));
  writeFileSync(join(out, "workbook-schema.json"), JSON.stringify(schema, null, 2));
  const dictionary = ["# Workbook data dictionary", "", "Generated without school records. All tabs also contain `_revision`, `_deleted`, `_updatedAt`. Legacy credentials and tokens are not importable.", ""];
  for (const s of Object.values(schema)) {
    dictionary.push(`## ${s.id}`, "", `Legacy source: ${s.sourceTable || "new operational tab"}`, "", "| Field | Type | Required | Reference |", "| --- | --- | --- | --- |",
      ...s.fields.map(f => `| ${f.key} | ${f.type} | ${f.required ? "yes" : "no"} | ${f.references || ""} |`), "");
  }
  writeFileSync(join(out, "DATA-DICTIONARY.md"), dictionary.join("\n"));
  for (const file of ["README.md", "ACCEPTANCE.md", "PARITY.md", "CAPACITY.md", "CONTRACT.md", "VERIFICATION.md", "INSTALL.html"]) copyFileSync(join(project, file), join(out, file));
  const zip = join(out, "attendance-google-apps-script.zip");
  execFileSync("python3", ["-m", "zipfile", "-c", zip, "apps-script", "BCRYPT-LICENSE", "README.md", "ACCEPTANCE.md", "PARITY.md", "CAPACITY.md", "VERIFICATION.md", "INSTALL.html", "DATA-DICTIONARY.md", "workbook-schema.json"], { cwd: out });
  console.log(`Built ${Object.keys(schema).length} workbook definitions and export package at generated-artifacts/google-portal/`);
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
