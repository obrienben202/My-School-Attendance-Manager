import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import vm from "node:vm";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { renderFixtureHtml } from "../tools/render-fixture.mjs";
import { prepareImport } from "../tools/prepare-import.mjs";

function sheet(name, width = 26) {
  const grid = [], writes = [];
  let maxRows = 1000, maxColumns = width;
  const result = {
    grid, writes, getName: () => name, setName: n => { name = n; },
    getLastRow: () => grid.length, getLastColumn: () => Math.max(0, ...grid.map(r => r.length)),
    getMaxRows: () => maxRows, getMaxColumns: () => maxColumns,
    insertRowsAfter: (_, n) => { maxRows += n; }, insertColumnsAfter: (_, n) => { maxColumns += n; },
    setFrozenRows: () => {},
    getRange: (row, col, nr, nc) => {
      assert.ok(row + nr - 1 <= maxRows && col + nc - 1 <= maxColumns, "Google grid bounds were exceeded");
      return {
        setNumberFormat() { return this; },
        getValues: () => Array.from({ length: nr }, (_, r) => Array.from({ length: nc }, (_, c) => grid[row + r - 1]?.[col + c - 1] ?? "")),
        getDisplayValues() { return this.getValues().map(r => r.map(v => String(v))); },
        setValues: values => {
          assert.equal(values.length, nr);
          writes.push({ row, col, nr, nc });
          values.forEach((valuesRow, r) => {
            assert.equal(valuesRow.length, nc);
            const target = grid[row + r - 1] ||= [];
            valuesRow.forEach((v, c) => { assert.ok(typeof v !== "string" || v.length <= 50000); target[col + c - 1] = v; });
          });
        },
      };
    },
  };
  return result;
}
function bindBook(h) {
  const tabs = new Map(), book = {
    getId: () => "synthetic-workbook", getSpreadsheetTimeZone: () => "Europe/London",
    getSheetByName: name => tabs.get(name),
  };
  for (const entity of Object.keys(h.schema)) {
    const s = sheet(entity, 100), headers = [...h.schema[entity].fields.map(f => f.key), "_revision", "_deleted", "_updatedAt"];
    s.grid.push(headers); tabs.set(entity, s);
  }
  h.context.SpreadsheetApp = { openById: () => book };
  return { tabs, book };
}
test("all tabs persist IDs first, including two learner assignments across fresh readers and edits", () => {
  const h = createHarness(), token = h.login("synthetic-admin");
  for (const definition of Object.values(h.schema)) assert.equal(definition.fields[0].key, "id", definition.id);
  assert.equal(h.schema.LearnerAssignments.fields.find(f => f.key === "studentId").unique, true);
  bindBook(h);
  const store = new h.RealSheetStore();
  for (const [entity, rows] of Object.entries(h.data)) for (const row of rows) store.put(entity, row);
  h.context.SheetStore_ = h.RealSheetStore;
  const first = h.data.LearnerAssignments[0];
  const second = h.rpc("save", token, { entity: "LearnerAssignments", record: {
    studentId: "s2", learnerUserId: h.data.AccountMappings.find(a => a.username === "synthetic-two").id, tutorUserId: first.tutorUserId,
  } });
  assert.equal(second.ok, true, JSON.stringify(second.error));
  assert.notEqual(second.data.id, first.id);
  for (const id of [first.id, second.data.id]) {
    const record = h.rpc("get", token, { entity: "LearnerAssignments", id });
    assert.equal(record.ok, true); assert.equal(record.data.id, id);
  }
  const edited = h.rpc("save", token, { entity: "LearnerAssignments", expectedRevision: 1, record: {
    id: first.id, tutorUserId: h.data.AccountMappings.find(a => a.username === "synthetic-other").id,
  } });
  assert.equal(edited.ok, true, JSON.stringify(edited.error));
  assert.equal(new h.RealSheetStore().rows("LearnerAssignments").find(a => a.id === first.id)._revision, 2);
  assert.equal(new h.RealSheetStore().rows("LearnerAssignments").length, 2);
});
test("legacy natural-key assignments receive repeatable IDs and pass the import dry run", () => {
  const h = createHarness();
  h.put("Students", { id: "11", personCode: "SYN-11", forename: "Synthetic", surname: "Import" });
  const input = { LearnerAssignments: [{ studentId: 11, learnerUserId: null, tutorUserId: null, updatedAt: "2026-11-21T12:00:00.000Z" }] };
  const batch = prepareImport(input).batches[0], again = prepareImport(input).batches[0];
  assert.equal(batch.tables.LearnerAssignments[0].id, "assignment_11");
  assert.equal(again.tables.LearnerAssignments[0].id, batch.tables.LearnerAssignments[0].id);
  assert.equal(h.context.importPlan_(new h.MemoryStore(), batch).issues.length, 0);
});
test("actual timetable form collection excludes readonly booleans and produces accepted create/edit payloads", () => {
  const h = createHarness(), token = h.login("synthetic-admin");
  const metadata = h.rpc("bootstrap", token).data.modules.find(m => m.id === "LessonSchedules");
  const client = readFileSync("google-apps-script-portal/src/Client.html", "utf8");
  const source = client.slice(client.indexOf("function buildForm("), client.indexOf("function conflictPanel(")).trim();
  const dom = (_tag, attrs = {}) => ({ value: attrs?.value ?? "", ...attrs,
    appendChild() {}, classList: { add() {}, remove() {} } });
  const buildForm = vm.runInNewContext("(" + source + ")", { h: dom });
  const form = buildForm(metadata.fields, null);
  for (const [key, value] of Object.entries(h.data.LessonSchedules[0])) if (form.controls[key] && !form.controls[key].ro) form.controls[key].set(value);
  const payload = form.collect();
  assert.ok(payload);
  assert.equal(form.controls.registerMarked.ro, true);
  assert.equal(form.controls.registerMarked.el.disabled, true);
  assert.equal(Object.hasOwn(payload, "registerMarked"), false);
  const created = h.rpc("save", token, { entity: "LessonSchedules", record: payload });
  assert.equal(created.ok, true, JSON.stringify(created.error));
  const editor = buildForm(metadata.fields, created.data);
  editor.controls.room.set("Synthetic room C");
  const edit = editor.collect();
  assert.equal(Object.hasOwn(edit, "registerMarked"), false);
  const saved = h.rpc("save", token, { entity: "LessonSchedules", record: { ...edit, id: created.data.id }, expectedRevision: created.data._revision });
  assert.equal(saved.ok, true, JSON.stringify(saved.error));
  assert.equal(h.rpc("get", token, { entity: "LessonSchedules", id: saved.data.id }).data.room, "Synthetic room C");
});
test("actual Sheets adapter preserves stable IDs after sorting and batches contiguous updates", () => {
  const h = createHarness(), { tabs } = bindBook(h);
  let store = new h.RealSheetStore();
  store.put("Courses", h.context.newRow_({ id: "b", code: "B", name: "Synthetic B" }));
  store.put("Courses", h.context.newRow_({ id: "a", code: "A", name: "Synthetic A" }));
  const tab = tabs.get("Courses"); [tab.grid[1], tab.grid[2]] = [tab.grid[2], tab.grid[1]];
  store = new h.RealSheetStore();
  const rows = store.rows("Courses");
  store.putMany(rows.map(r => ({ entity: "Courses", record: { ...r, name: "Changed " + r.id, _revision: 2 } })));
  const reread = new h.RealSheetStore().rows("Courses");
  assert.equal(reread.find(r => r.id === "a").name, "Changed a");
  assert.equal(reread.find(r => r.id === "b").name, "Changed b");
  assert.equal(tab.writes.at(-1).nr, 2);
  const before = JSON.stringify(tab.grid); tab.grid[0][1] = "unexpected";
  assert.throws(() => new h.RealSheetStore().rows("Courses"), /headers changed/);
  assert.equal(JSON.stringify(tab.grid.slice(1)), JSON.stringify(JSON.parse(before).slice(1)));
});
test("large structured records and journals survive fragment roundtrip and detect missing fragments", () => {
  const h = createHarness(), { tabs } = bindBook(h);
  const store = new h.RealSheetStore(), text = "Synthetic long answer. ".repeat(4000);
  const row = h.context.newRow_({ id: "large-review", work: { answers: { q1: text }, summary: "", targets: [], priorTargetUpdates: {} } });
  store.put("TermlyReviews", row);
  assert.ok(tabs.get("RecordFragments").grid.length > 2);
  const reread = new h.RealSheetStore().rows("TermlyReviews")[0];
  assert.equal(reread.work.answers.q1, text);
  store.put("Operations", h.context.newRow_({ id: "large-operation", plan: [{ entity: "TermlyReviews", record: row }], status: "prepared" }));
  assert.equal(new h.RealSheetStore().rows("Operations")[0].plan[0].record.work.answers.q1, text);
  const fragmentCount = tabs.get("RecordFragments").grid.length;
  store.put("TermlyReviews", row);
  assert.equal(tabs.get("RecordFragments").grid.length, fragmentCount, "Recovery must reuse content-addressed fragments");
  const fragments = tabs.get("RecordFragments"), ownerIndex = fragments.grid[0].indexOf("ownerEntity");
  fragments.grid.splice(fragments.grid.findIndex((r, i) => i > 0 && r[ownerIndex] === "TermlyReviews"), 1);
  assert.throws(() => new h.RealSheetStore().rows("TermlyReviews"), /fragments are incomplete/);
});
test("inline boot scripts emit quoted help URLs and remain valid JavaScript", () => {
  const html = renderFixtureHtml("https://script.google.com/macros/s/SYNTHETIC/exec");
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2, "Both the URL and actual client script must be rendered");
  assert.ok(html.includes("<style>")); assert.ok(!html.includes("<?"));
  for (const match of scripts) assert.doesNotThrow(() => new Script(match[1]));
});
test("the bundled browser bcrypt implementation verifies learner hashes without Node at runtime", () => {
  const require = createRequire(resolve("artifacts/api-server/package.json"));
  // CommonJS resolution selects the same UMD entry the export build copies.
  const umd = readFileSync(require.resolve("bcryptjs"), "utf8");
  const sandbox = vm.createContext({ Uint8Array, setTimeout, clearTimeout });
  vm.runInContext(umd, sandbox);
  const hash = sandbox.bcrypt.hashSync("Synthetic-only-42", "$2b$10$abcdefghijklmnopqrstuu");
  assert.equal(sandbox.bcrypt.compareSync("Synthetic-only-42", hash), true);
  assert.equal(sandbox.bcrypt.compareSync("wrong synthetic value", hash), false);
  const h = createHarness();
  delete h.properties.LEARNER_AUTH_URL;
  h.context.bcrypt = sandbox.bcrypt;
  h.state.sources["learner:synthetic-one"].passwordHash = hash;
  const signedIn = h.rpc("login", null, { audience: "learner", username: "synthetic-one", password: "Synthetic-only-42" });
  assert.equal(signedIn.ok, true, JSON.stringify(signedIn.error));
});
test("date-only cells use London dates, not UTC truncation; formula-like text never becomes a formula", () => {
  const h = createHarness(); bindBook(h);
  assert.equal(h.context.decodeCell_(new Date("2026-07-01T23:00:00Z"), { type: "date" }), "2026-07-02");
  const store = new h.RealSheetStore();
  store.put("Courses", h.context.newRow_({ id: "safe", name: "=SUM(A1)", code: "~ref:not-a-real-reference" }));
  const record = new h.RealSheetStore().rows("Courses")[0];
  assert.equal(record.name, "=SUM(A1)"); assert.equal(record.code, "~ref:not-a-real-reference");
});
test("initialiser creates only a new test workbook and refuses an unmarked populated source", () => {
  const h = createHarness();
  assert.throws(() => h.context.initializePortal_(), /existing workbook/);
  delete h.properties.MASTER_WORKBOOK_ID;
  const tabs = [sheet("Sheet1")];
  const book = { getId: () => "new-test-book", setSpreadsheetTimeZone: () => {}, getSpreadsheetTimeZone: () => "Europe/London",
    getSheets: () => tabs, insertSheet: n => { const s = sheet(n); tabs.push(s); return s; },
    getSheetByName: n => tabs.find(s => s.getName() === n) };
  h.context.SpreadsheetApp = { create: () => book, openById: () => book };
  h.context.DriveApp.getFileById = () => ({ getSharingAccess: () => "PRIVATE" });
  h.context.DriveApp.createFolder = () => ({ getSharingAccess: () => "PRIVATE", getId: () => "new-test-folder" });
  h.context.SheetStore_ = h.RealSheetStore;
  const created = h.context.initializePortal_();
  assert.equal(created.created, true); assert.equal(tabs.length, Object.keys(h.schema).length);
  const before = JSON.stringify(tabs.map(s => s.grid));
  assert.equal(h.context.initializePortal_().reused, true);
  assert.equal(JSON.stringify(tabs.map(s => s.grid)), before);
});
test("directory reads only named identity columns, never the plaintext password column", () => {
  const h = createHarness(), reads = [];
  h.properties.STAFF_DIRECTORY_ID = "synthetic-directory"; h.properties.STAFF_DIRECTORY_TAB = "Accounts";
  const source = sheet("Accounts");
  source.grid.push(["Username", "Password", "Role", "FullName", "Active"], ["synthetic", "DO-NOT-READ", "teacher", "Synthetic Teacher", "true"]);
  const range = source.getRange;
  source.getRange = (row, col, nr, nc) => { reads.push({ row, col, nc }); assert.ok(!(row > 1 && col <= 2 && col + nc > 2), "Plaintext password was read"); return range(row, col, nr, nc); };
  h.context.SpreadsheetApp = { openById: () => ({ getSheetByName: () => source }) };
  const rows = h.context.directoryRows_("staff", false);
  assert.equal(rows[0].role, "staff"); assert.equal(rows[0].password, undefined);
  assert.ok(!reads.some(r => r.row > 1 && r.col === 2));
  source.grid.push(["synthetic", "DO-NOT-READ", "teacher", "Duplicate", "true"]);
  assert.throws(() => h.context.directoryRows_("staff", false), /Duplicate/);
});
