// Editor-only entrypoints end in underscore, preventing google.script.run access.
function initializePortal_() {
  var properties = PropertiesService.getScriptProperties(), p = properties.getProperties();
  if (p.MODE !== "TEST" || !p.SESSION_KEY || p.SESSION_KEY.length < 32) failure_("CONFIG", "Set MODE=TEST and a private SESSION_KEY of at least 32 random characters first.");
  if (p.MASTER_WORKBOOK_ID) {
    if (p.INITIALIZED_WORKBOOK_ID !== p.MASTER_WORKBOOK_ID) failure_("CONFIG", "Refusing to initialise an existing workbook. Create a separate empty test workbook.");
    var existing = new SheetStore_();
    Object.keys(PortalSchema).forEach(function(entity) { existing.rows(entity); });
    if (!existing.rows("SchemaVersions").some(function(v) { return equalId_(v.version, PORTAL_VERSION); })) failure_("CONFIG", "Workbook version differs; an explicit migration is required.");
    return { reused: true, workbookId: p.MASTER_WORKBOOK_ID };
  }
  var book = SpreadsheetApp.create("Attendance Learning Hub — private TEST");
  book.setSpreadsheetTimeZone("Europe/London");
  if (DriveApp.getFileById(book.getId()).getSharingAccess() !== DriveApp.Access.PRIVATE) failure_("CONFIG", "School policy did not create a private workbook. No sharing settings were changed.");
  Object.keys(PortalSchema).forEach(function(entity, index) {
    var sheet = index === 0 ? book.getSheets()[0] : book.insertSheet(entity);
    if (index === 0) sheet.setName(entity);
    if (sheet.getMaxColumns() < headers_(entity).length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers_(entity).length - sheet.getMaxColumns());
    sheet.getRange(1, 1, 1, headers_(entity).length).setValues([headers_(entity)]);
    sheet.setFrozenRows(1);
  });
  var folder = DriveApp.createFolder("Attendance Learning Hub — private TEST uploads");
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) failure_("CONFIG", "The test upload folder is not private. Inspect school policy before proceeding.");
  properties.setProperties({ MASTER_WORKBOOK_ID: book.getId(), INITIALIZED_WORKBOOK_ID: book.getId(), UPLOAD_FOLDER_ID: folder.getId() });
  var store = new SheetStore_();
  store.put("SchemaVersions", newRow_({ version: PORTAL_VERSION, createdAt: now_() }));
  [["schoolName", "Attendance Learning Hub"], ["academicYear", ""], ["helpText", ""]].forEach(function(pair) { store.put("Settings", newRow_({ key: pair[0], value: pair[1] })); });
  return { created: true, workbookId: book.getId(), folderId: folder.getId() };
}
function syncAccounts_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) failure_("BUSY", "Another save is in progress.");
  try {
    var store = new SheetStore_(); recover_(store);
    var staff = directoryRows_("staff", false), p = config_();
    var learners = p.LEARNER_DIRECTORY_ID && p.LEARNER_DIRECTORY_TAB ? directoryRows_("learner", false) : [];
    var plan = [], linked = 0, unlinked = 0;
    staff.map(function(r) { return { audience: "staff", record: r }; }).concat(learners.map(function(r) { return { audience: "learner", record: r }; })).forEach(function(item) {
      var source = item.record;
      var previous = store.rows("AccountMappings").find(function(a) { return normalUsername_(a.username) === source.username && (a.audience || (a.role === "learner" ? "learner" : "staff")) === item.audience; });
      var account = previous ? copy_(previous) : newRow_({ username: source.username, createdAt: now_() });
      account.audience = item.audience; account.role = source.role; account.active = source.active;
      account.firstName = source.displayName || source.username; account.department = source.department || null;
      account.profile = { email: source.email || null, phone: source.phone || null, jobTitle: source.jobTitle || null };
      if (item.audience === "learner") {
        var matches = store.rows("Students").filter(function(s) { return active_(s) && !!source.personCode && equalId_(s.personCode, source.personCode); });
        account.studentId = matches.length === 1 ? matches[0].id : null;
        if (!account.studentId) { account.active = false; unlinked++; } else linked++;
      }
      account._revision = previous ? previous._revision + 1 : 1; account.updatedAt = now_(); account._updatedAt = now_();
      plan.push({ entity: "AccountMappings", record: account });
    });
    // Bounded batches remain resumable; directory removal is enforced immediately on every request.
    for (var i = 0; i < plan.length; i += 10) commit_(store, { id: "school-owner" }, { action: "directorySync", requestId: uuid_(), payload: { batch: i } }, plan.slice(i, i + 10), { synced: Math.min(10, plan.length - i) });
    return { synced: plan.length, linkedLearners: linked, disabledUnlinkedLearners: unlinked };
  } finally { lock.releaseLock(); }
}
function inspectPortal_() {
  var store = new SheetStore_(), counts = {};
  Object.keys(PortalSchema).forEach(function(entity) { counts[entity] = store.rows(entity).filter(active_).length; });
  return { schemaVersion: PORTAL_VERSION, mode: config_().MODE || "UNSET", counts: counts, preparedOperations: store.rows("Operations").filter(function(o) { return o.status === "prepared"; }).length,
    runtimeAcceptance: "NOT ATTESTED: complete the school-owner acceptance checklist before cutover." };
}
function backupPortal_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) failure_("BUSY", "Another save is in progress.");
  try {
    var store = new SheetStore_(); recover_(store);
    var backup = DriveApp.getFileById(config_().MASTER_WORKBOOK_ID).makeCopy("Attendance private backup " + now_());
    if (backup.getSharingAccess() !== DriveApp.Access.PRIVATE) failure_("CONFIG", "Backup privacy needs owner review.");
    return { privateBackupId: backup.getId(), at: now_(), note: "Contains sensitive school records and hashed sessions; never publish or import its session rows." };
  } finally { lock.releaseLock(); }
}
