function config_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  if (!p.MASTER_WORKBOOK_ID || !p.SESSION_KEY || p.SESSION_KEY.length < 32) failure_("CONFIG", "The school owner must finish the private Google configuration.");
  return p;
}
function now_() { return new Date().toISOString(); }
function uuid_() { return Utilities.getUuid(); }
function digest_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, string_(value), Utilities.Charset.UTF_8)).replace(/=+$/, "");
}
function token_() {
  var seed = uuid_() + ":" + uuid_() + ":" + now_();
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(seed, config_().SESSION_KEY, Utilities.Charset.UTF_8));
}
function headers_(entity) {
  return PortalSchema[entity].fields.map(function(f) { return f.key; }).concat(["_revision", "_deleted", "_updatedAt"]);
}
function encodeCell_(value, field) {
  if (value == null) return "";
  if (field && field.type === "json") return JSON.stringify(value);
  if (typeof value === "string" && /^(?:[=+\-@]|~p:|~ref:)/.test(value)) return "~p:" + JSON.stringify(value);
  return value;
}
function decodeCell_(value, field) {
  if (value === "") return null;
  if (typeof value === "string" && value.indexOf("~p:") === 0) return JSON.parse(value.slice(3));
  if (field && field.type === "json") return typeof value === "string" ? JSON.parse(value) : value;
  if (value instanceof Date) return field && field.type === "date" ? Utilities.formatDate(value, "Europe/London", "yyyy-MM-dd") : value.toISOString();
  if (field && field.type === "text") return String(value);
  return value;
}
function SheetStore_() {
  this.book = SpreadsheetApp.openById(config_().MASTER_WORKBOOK_ID);
  this.cache = {};
  if (this.book.getSpreadsheetTimeZone() !== "Europe/London") failure_("CONFIG", "Workbook timezone must be Europe/London.");
}
SheetStore_.prototype.rows = function(entity) {
  var self = this;
  if (this.cache[entity]) return this.cache[entity];
  var sheet = this.book.getSheetByName(entity);
  if (!sheet) failure_("CONFIG", "Workbook schema is incomplete. Ask the owner to inspect setup.");
  var expected = headers_(entity), actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(expected) || sheet.getLastColumn() !== expected.length) failure_("CONFIG", "Workbook headers changed in " + entity + ". No data was overwritten.");
  var count = sheet.getLastRow() - 1, limit = Math.min(50000, Math.max(100, Number(config_().MAX_TABLE_ROWS) || 10000));
  if (count > limit) failure_("CAPACITY", "This workbook needs an approved archive or capacity review before more records can be read.");
  var values = count ? sheet.getRange(2, 1, count, expected.length).getValues() : [];
  var fields = PortalSchema[entity].fields;
  var rows = values.filter(function(row) { return row[0] !== ""; }).map(function(row) {
    var record = {};
    expected.forEach(function(key, i) { record[key] = decodeStoredCell_(self, entity, String(row[0]), key, row[i], fields[i]); });
    record.id = String(record.id);
    record._revision = Number(record._revision) || 0;
    record._deleted = record._deleted === true;
    return record;
  });
  if (new Set(rows.map(function(r) { return r.id; })).size !== rows.length) failure_("CONFIG", "Duplicate record IDs were found in " + entity + ".");
  this.cache[entity] = rows;
  return rows;
};
SheetStore_.prototype.put = function(entity, record) {
  var thisStore = this;
  var rows = this.rows(entity), sheet = this.book.getSheetByName(entity), index = rows.findIndex(function(r) { return equalId_(r.id, record.id); });
  if (index < 0 && rows.length >= Math.min(50000, Math.max(100, Number(config_().MAX_TABLE_ROWS) || 10000))) failure_("CAPACITY", "Table capacity reached; the school owner must review retention.");
  var fields = PortalSchema[entity].fields, values = headers_(entity).map(function(key, i) {
    var cell = encodeStoredCell_(thisStore, entity, record.id, key, record[key], fields[i]);
    if (String(cell).length > 40000) failure_("CAPACITY", "A record is too large for a safe spreadsheet cell.");
    return cell;
  });
  // Resolve the physical row by ID: sorting or blank rows must not redirect an edit.
  var physical = -1;
  if (index >= 0) {
    var ids = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
    physical = ids.findIndex(function(v) { return equalId_(v[0], record.id); }) + 2;
    if (physical < 2) failure_("CONFIG", "Record ID moved during save.");
  }
  var destination = physical >= 2 ? physical : sheet.getLastRow() + 1;
  ensureRows_(sheet, destination);
  sheet.getRange(destination, 1, 1, values.length).setNumberFormat("@").setValues([values]);
  if (index < 0) rows.push(copy_(record)); else rows[index] = copy_(record);
};
function ensureRows_(sheet, required) {
  if (sheet.getMaxRows() < required) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(100, required - sheet.getMaxRows()));
}
function encodeStoredCell_(store, entity, id, key, value, field) {
  var cell = encodeCell_(value, field);
  if (typeof cell !== "string" || cell.length <= 24000) return cell;
  if (entity === "RecordFragments" || cell.length > (entity === "Operations" ? 1000000 : 300000)) failure_("CAPACITY", "Record exceeds the reviewed fragment capacity.");
  var hash = digest_(cell), count = Math.ceil(cell.length / 12000);
  for (var i = 0; i < count; i++) {
    var fragmentId = "frag_" + digest_(entity + ":" + id + ":" + key + ":" + hash + ":" + i);
    store.put("RecordFragments", newRow_({ id: fragmentId, ownerEntity: entity, ownerId: id, field: key, digest: hash, part: i, content: cell.slice(i * 12000, (i + 1) * 12000) }));
  }
  return "~ref:" + JSON.stringify({ hash: hash, count: count });
}
function decodeStoredCell_(store, entity, id, key, value, field) {
  if (typeof value !== "string" || value.indexOf("~ref:") !== 0) return decodeCell_(value, field);
  if (entity === "RecordFragments") failure_("CONFIG", "Nested record fragments are not allowed.");
  var reference = JSON.parse(value.slice(5));
  if (!Number.isInteger(reference.count) || reference.count < 1 || reference.count > 84) failure_("CONFIG", "Record fragment metadata is invalid.");
  var fragments = store.rows("RecordFragments").filter(function(r) { return active_(r) && r.ownerEntity === entity && equalId_(r.ownerId, id) && r.field === key && r.digest === reference.hash; }).sort(function(a, b) { return a.part - b.part; });
  if (fragments.length !== reference.count || fragments.some(function(r, i) { return r.part !== i; })) failure_("INCOMPLETE_OPERATION", "A record's private fragments are incomplete; restore or recover before continuing.");
  var joined = fragments.map(function(r) { return r.content; }).join("");
  if (digest_(joined) !== reference.hash) failure_("CONFIG", "Record fragment integrity check failed.");
  return decodeCell_(joined, field);
}
function find_(store, entity, id) {
  return store.rows(entity).find(function(row) { return active_(row) && equalId_(row.id, id); }) || null;
}
function newRow_(data) {
  return Object.assign({ id: uuid_() }, data, { _revision: 1, _deleted: false, _updatedAt: now_() });
}
function applyPlan_(store, operation) {
  if (store.putMany) store.putMany(operation.plan);
  else operation.plan.forEach(function(change) { store.put(change.entity, change.record); });
  operation.status = "committed";
  store.put("Operations", operation);
}
SheetStore_.prototype.putMany = function(changes) {
  var self = this, groups = {};
  changes.forEach(function(change) { (groups[change.entity] || (groups[change.entity] = [])).push(change.record); });
  Object.keys(groups).forEach(function(entity) {
    var rows = self.rows(entity), sheet = self.book.getSheetByName(entity), fields = PortalSchema[entity].fields, heads = headers_(entity);
    var last = sheet.getLastRow(), ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [], positions = {};
    ids.forEach(function(row, i) { if (row[0] !== "") positions[String(row[0])] = i + 2; });
    var writes = groups[entity].map(function(record) {
      var position = positions[record.id];
      if (!position) { position = ++last; positions[record.id] = position; }
      var values = heads.map(function(key, i) { var value = encodeStoredCell_(self, entity, record.id, key, record[key], fields[i]); if (String(value).length > 40000) failure_("CAPACITY", "Record exceeds the safe cell size."); return value; });
      return { position: position, values: values, record: record };
    }).sort(function(a, b) { return a.position - b.position; });
    if (last - 1 > Math.min(50000, Math.max(100, Number(config_().MAX_TABLE_ROWS) || 10000))) failure_("CAPACITY", "Reviewed table capacity reached.");
    ensureRows_(sheet, last);
    for (var start = 0; start < writes.length;) {
      var end = start + 1;
      while (end < writes.length && writes[end].position === writes[end - 1].position + 1) end++;
      sheet.getRange(writes[start].position, 1, end - start, heads.length).setNumberFormat("@").setValues(writes.slice(start, end).map(function(w) { return w.values; }));
      start = end;
    }
    writes.forEach(function(w) {
      var index = rows.findIndex(function(r) { return equalId_(r.id, w.record.id); });
      if (index < 0) rows.push(copy_(w.record)); else rows[index] = copy_(w.record);
    });
  });
};
function recover_(store) {
  var pending = store.rows("Operations").filter(function(o) { return o.status === "prepared"; });
  if (pending.length > 20) failure_("INCOMPLETE_OPERATION", "Too many interrupted operations require owner review.");
  pending.forEach(function(o) {
    try { applyPlan_(store, o); }
    catch (_) { failure_("INCOMPLETE_OPERATION", "An interrupted save needs recovery. Your request was not reported as successful."); }
  });
}
function previousOperation_(store, actor, request, fingerprint) {
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(string_(request.requestId))) failure_("VALIDATION", "A unique submission ID is required.");
  var existing = store.rows("Operations").find(function(o) { return o.actorId === actor.id && o.requestId === request.requestId; });
  if (existing && existing.fingerprint !== fingerprint) failure_("CONFLICT", "This submission ID was already used for different data. Start a separate save.");
  if (existing && existing.status !== "committed") failure_("INCOMPLETE_OPERATION", "Your earlier save is awaiting recovery.");
  return existing;
}
function commit_(store, actor, request, plan, result) {
  var fingerprint = digest_(JSON.stringify({ action: request.action, payload: request.payload || {} }));
  var existing = previousOperation_(store, actor, request, fingerprint);
  if (existing) return copy_(existing.result);
  var operation = newRow_({ actorId: actor.id, requestId: request.requestId, fingerprint: fingerprint, status: "prepared", plan: plan, result: result, at: now_() });
  plan.push({ entity: "AuditLog", record: newRow_({ actorId: actor.id, action: request.action, entity: plan[0] ? plan[0].entity : "", recordId: plan[0] ? plan[0].record.id : "", at: now_(), operationId: operation.id }) });
  operation.plan = plan;
  // Journal is durable before touching records. Only a committed journal is success.
  store.put("Operations", operation);
  try { applyPlan_(store, operation); }
  catch (_) { failure_("INCOMPLETE_OPERATION", "Save was interrupted. Keep this submission ID and retry; do not make a duplicate submission."); }
  return copy_(result);
}
