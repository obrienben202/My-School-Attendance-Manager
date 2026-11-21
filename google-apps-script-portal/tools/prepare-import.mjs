import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSchema } from "./build.mjs";

export function prepareImport(input) {
  const schema = buildSchema(), tables = {}, omissions = [], warnings = [];
  const source = input.tables || input;
  for (const [name, records] of Object.entries(source)) {
    const definition = schema[name] || Object.values(schema).find(s => s.sourceTable === name);
    if (!definition || !Array.isArray(records)) throw new Error(`Unknown export table: ${name}`);
    if (["LegacySessions", "LegacyPhotoUploads"].includes(definition.id)) {
      omissions.push({ table: name, count: records.length, reason: "Session tokens are never migrated; legacy upload records require private file reconciliation." }); continue;
    }
    if (["Operations", "SessionRecords", "AuditLog", "SchemaVersions", "UploadMetadata", "RecordFragments"].includes(definition.id)) throw new Error("Security/operational tables cannot be imported.");
    tables[definition.id] = records.map(inputRow => {
      const record = {};
      for (const [key, value] of Object.entries(inputRow)) {
        if (key === "passwordHash" || key === "password_hash" || key === "password") { omissions.push({ table: name, field: key, reason: "Credentials deliberately omitted." }); continue; }
        const field = definition.fields.find(f => f.key === key || f.sourceColumn === key);
        if (!field) throw new Error(`Unmapped field ${name}.${key}; nothing was silently discarded.`);
        record[field.key] = value == null ? null : field.references || field.key === "id" ? String(value) : field.type === "number" ? Number(value) : value;
      }
      if (definition.id === "AccountMappings") { record.audience = record.role === "learner" ? "learner" : "staff"; record.active = false; }
      if (record.photoObjectPath || record.profileImageUrl) warnings.push("Legacy photo references require authorised private file transfer; bytes are not included.");
      return record;
    });
  }
  for (const review of tables.TermlyReviews || []) {
    (review.history || []).forEach((event, index) => {
      if (event.action === "staff_comment" && typeof event.comment === "string" && event.comment.trim()) {
        (tables.StaffComments ||= []).push({ id: `legacy-comment_${review.id}_${index}`, reviewId: review.id, comment: event.comment, authorUserId: event.actorId, at: event.at });
      }
    });
  }
  // Dependency order; a batch carries only records whose prerequisites have been emitted.
  const order = [], remaining = new Set(Object.keys(tables));
  while (remaining.size) {
    const ready = [...remaining].filter(id => schema[id].fields.every(f => !f.references || f.references === id || !remaining.has(f.references)));
    if (!ready.length) throw new Error("Circular import references require an explicit reviewed mapping.");
    for (const id of ready) { order.push(id); remaining.delete(id); }
  }
  const batches = [];
  for (const id of order) {
    let rows = [];
    for (const row of tables[id]) {
      const next = [...rows, row];
      if (next.length > 10 || JSON.stringify(next).length > 220000) {
        if (!rows.length) throw new Error("An individual source record exceeds the safe import batch size.");
        batches.push({ schemaVersion: "1", tables: { [id]: rows } }); rows = [];
      }
      rows.push(row);
    }
    if (rows.length) batches.push({ schemaVersion: "1", tables: { [id]: rows } });
  }
  return { batches, report: { tables: Object.fromEntries(Object.entries(tables).map(([id, rows]) => [id, rows.length])), omissions, warnings: [...new Set(warnings)], liveDataAccessed: false } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [inputPath, outputDir] = process.argv.slice(2);
  if (!inputPath || !outputDir || !resolve(outputDir).includes("/generated-artifacts/")) throw new Error("Usage: node prepare-import.mjs <authorised-local-export.json> <generated-artifacts/private-import-directory>");
  const result = prepareImport(JSON.parse(readFileSync(inputPath, "utf8")));
  mkdirSync(outputDir, { recursive: true });
  result.batches.forEach((batch, i) => writeFileSync(resolve(outputDir, `batch-${String(i + 1).padStart(4, "0")}.json`), JSON.stringify(batch, null, 2), { mode: 0o600 }));
  writeFileSync(resolve(outputDir, "reconciliation.json"), JSON.stringify(result.report, null, 2), { mode: 0o600 });
  console.log(`Prepared ${result.batches.length} private batches. Review reconciliation before any Google import.`);
}
