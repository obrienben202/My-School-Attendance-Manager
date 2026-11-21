function importPlan_(store, envelope) {
  if (!envelope || envelope.schemaVersion !== PORTAL_VERSION || !envelope.tables || typeof envelope.tables !== "object") failure_("VALIDATION", "Use the versioned import format from the offline preparation tool.");
  var blocked = ["LegacySessions", "SessionRecords", "Operations", "AuditLog", "SchemaVersions", "UploadMetadata", "LegacyPhotoUploads", "RecordFragments"];
  var plan = [], counts = {}, issues = [], warnings = [];
  Object.keys(envelope.tables).forEach(function(entity) {
    if (!Object.prototype.hasOwnProperty.call(PortalSchema, entity) || blocked.indexOf(entity) >= 0 || !Array.isArray(envelope.tables[entity])) failure_("VALIDATION", "Unsupported or security-sensitive import table.");
    counts[entity] = envelope.tables[entity].length;
    envelope.tables[entity].forEach(function(input) {
      if (!input || !/^[a-zA-Z0-9_-]{1,100}$/.test(string_(input.id))) failure_("VALIDATION", "Every imported record needs a stable source ID.");
      var keys = PortalSchema[entity].fields.map(function(f) { return f.key; });
      if (Object.keys(input).some(function(k) { return keys.indexOf(k) < 0; })) failure_("VALIDATION", "Import contains unknown or credential fields.");
      var record = copy_(input); record.id = String(record.id);
      PortalSchema[entity].fields.forEach(function(f) {
        if (f.references && record[f.key] != null) record[f.key] = String(record[f.key]);
        if (record[f.key] === undefined && f.defaultValue !== undefined) record[f.key] = copy_(f.defaultValue);
      });
      if (entity === "AccountMappings") {
        record.audience = record.role === "learner" ? "learner" : "staff";
        record.active = false; // Only a subsequent verified directory sync may activate accounts.
      }
      var existing = find_(store, entity, record.id);
      if (existing) failure_("CONFLICT", "Import would overwrite an existing ID. Reconcile the dry run first.");
      Object.assign(record, { _revision: Math.max(1, Number(record.revision) || 1), _deleted: false, _updatedAt: now_() });
      plan.push({ entity: entity, record: record });
      if (record.photoObjectPath || record.profileImageUrl) warnings.push(entity + " has a legacy photo reference requiring private-file reconciliation.");
    });
  });
  var shadow = { rows: function(entity) {
    return store.rows(entity).concat(plan.filter(function(c) { return c.entity === entity; }).map(function(c) { return c.record; }));
  } };
  var ids = {};
  plan.forEach(function(change) {
    var key = change.entity + ":" + change.record.id;
    if (ids[key]) issues.push("Duplicate input record ID.");
    ids[key] = true;
    try { validate_(shadow, change.entity, change.record); } catch (e) { issues.push(change.entity + ": " + e.message); }
  });
  return { plan: plan, counts: counts, issues: issues, warnings: Array.from(new Set(warnings)), ready: issues.length === 0 };
}
function importEnvelope_() {
  var p = config_();
  if (!p.IMPORT_FILE_ID) failure_("CONFIG", "Choose a private, prepared import file in Script Properties.");
  var file = DriveApp.getFileById(p.IMPORT_FILE_ID);
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE || file.getSize() > 2000000) failure_("VALIDATION", "Use a private import file smaller than 2 MB.");
  return JSON.parse(file.getBlob().getDataAsString("UTF-8"));
}
function dryRunImport_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) failure_("BUSY", "Another save is in progress.");
  try {
    var store = new SheetStore_(), result = importPlan_(store, importEnvelope_());
    return { counts: result.counts, issues: result.issues, warnings: result.warnings, ready: result.ready, written: 0 };
  } finally { lock.releaseLock(); }
}
function importApprovedTestCopy_() {
  var p = config_();
  if (p.MODE !== "TEST" || p.IMPORT_APPROVAL !== "APPROVED_TEST_COPY") failure_("FORBIDDEN", "Import requires explicit owner approval and a separate TEST workbook.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) failure_("BUSY", "Another save is in progress.");
  try {
    var store = new SheetStore_(); recover_(store);
    var envelope = importEnvelope_(), request = { action: "approvedTestImport", requestId: "import_" + digest_(JSON.stringify(envelope)).replace(/[^a-zA-Z0-9_-]/g, ""), payload: { digest: digest_(JSON.stringify(envelope)) } };
    var prior = store.rows("Operations").find(function(o) { return o.actorId === "school-owner" && o.requestId === request.requestId && o.status === "committed"; });
    if (prior) return prior.result;
    var result = importPlan_(store, envelope);
    if (!result.ready) failure_("VALIDATION", "Dry run failed. No records were imported.", { issues: result.issues });
    if (result.plan.length > 20 || JSON.stringify(result.plan).length > 800000) failure_("CAPACITY", "Split this import into smaller dependency-ordered batches using the preparation tool.");
    return commit_(store, { id: "school-owner" }, request, result.plan, { imported: result.plan.length, counts: result.counts, warnings: result.warnings });
  } finally { lock.releaseLock(); }
}
function reconcileTransferredFiles_() {
  // Read-only owner check: does not move files or change sharing.
  var store = new SheetStore_(), rows = store.rows("UploadMetadata").filter(active_), valid = 0, unavailable = 0;
  rows.forEach(function(row) { try { verifiedFile_(row); valid++; } catch (_) { unavailable++; } });
  return { checked: rows.length, valid: valid, unavailable: unavailable, complete: unavailable === 0,
    note: "Legacy photo references need manual reconciliation and authorised private re-upload before cutover." };
}
