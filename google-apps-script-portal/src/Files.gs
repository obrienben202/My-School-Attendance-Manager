function privateFolder_() {
  var id = config_().UPLOAD_FOLDER_ID;
  if (!id) failure_("CONFIG", "Private upload storage has not been configured.");
  var folder = DriveApp.getFolderById(id);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE || otherFileUsers_(folder)) failure_("CONFIG", "Uploads require an owner-only private folder; sharing was not changed.");
  return folder;
}
function otherFileUsers_(item) {
  var owner = item.getOwner ? item.getOwner() : null, email = owner && owner.getEmail ? owner.getEmail() : "";
  return item.getEditors().concat(item.getViewers()).some(function(user) { return !email || user.getEmail() !== email; });
}
function fileMetadata_(file, actor, entity, recordId, contentHash) {
  return newRow_({ entity: entity, recordId: String(recordId), driveFileId: file.getId(), name: file.getName(), mimeType: file.getMimeType(), size: file.getSize(), uploadedBy: actor.id, at: now_(), contentHash: contentHash });
}
function safeFile_(row) { return { id: row.id, name: row.name, mimeType: row.mimeType, size: row.size, at: row.at }; }
function visibleFile_(actor, metadata) {
  // A projected learner roster is not permission to read its office documents.
  if (["Students", "StudentEnrolments"].indexOf(metadata.entity) >= 0 && metadata.mimeType === "application/pdf") return actor.role === "admin" || actor.role === "office";
  return true;
}
function fileTarget_(store, actor, entity, id, editing) {
  module_(entity);
  if (["Students", "StudentEnrolments", "ILPs", "TermlyReviews", "ConciergeApplications", "SafeguardingNotes"].indexOf(entity) < 0) failure_("FORBIDDEN", "Files are not enabled for this record area.");
  return authorised_(store, entity, id, actor, editing);
}
function upload_(store, actor, request) {
  var p = request.payload;
  fileTarget_(store, actor, p.entity, p.id, true);
  if (!/^(image\/jpeg|image\/png|application\/pdf)$/.test(string_(p.mimeType)) || typeof p.base64 !== "string" || p.base64.length > 2796204 || !/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64)) failure_("VALIDATION", "Choose a JPEG, PNG or PDF no larger than 2 MB.");
  var bytes;
  try { bytes = Utilities.base64Decode(p.base64); } catch (_) { failure_("VALIDATION", "The upload is not a valid file."); }
  if (!bytes.length || bytes.length > 2097152) failure_("VALIDATION", "File must be between 1 byte and 2 MB.");
  var positive = bytes.slice(0, 8).map(function(b) { return b & 255; });
  var valid = p.mimeType === "image/png" ? positive.join(",") === "137,80,78,71,13,10,26,10" : p.mimeType === "image/jpeg" ? positive[0] === 255 && positive[1] === 216 && positive[2] === 255 : positive.slice(0, 5).join(",") === "37,80,68,70,45";
  if (!valid) failure_("VALIDATION", "The file contents do not match the selected file type.");
  var name = string_(p.name).replace(/[\/\\\u0000-\u001f\u202a-\u202e]/g, "_").slice(0, 120);
  if (!name) failure_("VALIDATION", "A file name is required.");
  if (!(p.mimeType === "image/png" ? /\.png$/i : p.mimeType === "image/jpeg" ? /\.jpe?g$/i : /\.pdf$/i).test(name)) failure_("VALIDATION", "File extension must match its type.");
  var file = privateFolder_().createFile(Utilities.newBlob(bytes, p.mimeType, name));
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE || otherFileUsers_(file)) { file.setTrashed(true); failure_("CONFIG", "School policy did not create a private file. The failed upload was removed; sharing settings were not changed."); }
  var metadata = fileMetadata_(file, actor, p.entity, p.id, digest_(Utilities.base64Encode(bytes)));
  try { return commit_(store, actor, request, [{ entity: "UploadMetadata", record: metadata }], safeFile_(metadata)); }
  catch (err) {
    // A prepared journal must keep its file for recovery; only an unjournalled orphan is removed.
    var prepared = store.rows("Operations").some(function(o) { return o.actorId === actor.id && o.requestId === request.requestId; });
    if (!prepared) file.setTrashed(true);
    throw err;
  }
}
function files_(store, actor, payload) {
  fileTarget_(store, actor, payload.entity, payload.id, false);
  return store.rows("UploadMetadata").filter(function(f) { return active_(f) && f.entity === payload.entity && equalId_(f.recordId, payload.id) && visibleFile_(actor, f); }).map(safeFile_);
}
function verifiedFile_(metadata) {
  var file = DriveApp.getFileById(metadata.driveFileId), folder = privateFolder_(), parents = file.getParents(), inFolder = false;
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) inFolder = true;
  if (!inFolder || file.isTrashed() || file.getSharingAccess() !== DriveApp.Access.PRIVATE || otherFileUsers_(file) || file.getSize() > 2097152 || file.getSize() !== metadata.size || file.getMimeType() !== metadata.mimeType) failure_("NOT_FOUND", "The private file is unavailable or its access/contents changed.");
  var base64 = Utilities.base64Encode(file.getBlob().getBytes());
  if (digest_(base64) !== metadata.contentHash) failure_("VALIDATION", "File contents changed after upload; the original must be reconciled.");
  return base64;
}
function download_(store, actor, payload) {
  var metadata = find_(store, "UploadMetadata", payload.id);
  if (!metadata) failure_("NOT_FOUND", "File not found.");
  fileTarget_(store, actor, metadata.entity, metadata.recordId, false);
  if (!visibleFile_(actor, metadata)) failure_("NOT_FOUND", "File not found.");
  return { name: metadata.name, mimeType: metadata.mimeType, base64: verifiedFile_(metadata) };
}
