function include_(name) {
  if (["Styles", "Client"].indexOf(name) < 0) throw new Error("Unknown template include.");
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
function doGet(e) {
  if (e && e.parameter && e.parameter.view === "help") return HtmlService.createHtmlOutputFromFile("Help").setTitle("Attendance Learning Hub — help").addMetaTag("viewport", "width=device-width, initial-scale=1");
  var template = HtmlService.createTemplateFromFile("Index");
  template.serviceUrl = ScriptApp.getService().getUrl() || "";
  return template.evaluate().setTitle("Attendance Learning Hub").addMetaTag("viewport", "width=device-width, initial-scale=1");
}
function portalRpc(request) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: { code: "BUSY", message: "The portal is saving another request. Keep your draft and retry shortly.", details: null } };
  try {
    if (!request || typeof request !== "object" || typeof request.action !== "string" || JSON.stringify(request).length > 2900000) failure_("VALIDATION", "Invalid request.");
    var store = new SheetStore_();
    recover_(store);
    if (request.action === "login") return { ok: true, data: login_(store, request.payload || {}) };
    var actor = authenticate_(store, request.token), p = request.payload || {}, result;
    var mutations = ["save", "remove", "submitRegister", "saveLearnerReview", "addStaffComment", "upload"];
    if (mutations.indexOf(request.action) >= 0) {
      var previous = previousOperation_(store, actor, request, digest_(JSON.stringify({ action: request.action, payload: p })));
      if (previous) {
        var primary = previous.plan[0];
        if (primary && primary.entity === "UploadMetadata") fileTarget_(store, actor, primary.record.entity, primary.record.recordId, false);
        else if (primary && !scope_(store, actor, primary.entity, primary.record, false)) failure_("FORBIDDEN", "Your access to this earlier submission changed.");
        return { ok: true, data: copy_(previous.result) };
      }
    }
    switch (request.action) {
      case "logout":
        store.rows("SessionRecords").filter(function(s) { return s.tokenHash === digest_(request.token); }).forEach(function(s) { s.revoked = true; store.put("SessionRecords", s); });
        result = { signedOut: true }; break;
      case "bootstrap": result = { user: actor, modules: modulesFor_(actor), notices: ["The master workbook is private; use this portal, not a shared spreadsheet.", "Keep drafts open if a save fails. School approval is required before any live migration or cutover."] }; break;
      case "dashboard": result = dashboard_(store, actor); break;
      case "list": result = list_(store, actor, p); break;
      case "get": result = get_(store, actor, p); break;
      case "save": result = save_(store, actor, request); break;
      case "remove": result = remove_(store, actor, request); break;
      case "register": result = register_(store, actor, p); break;
      case "submitRegister": result = submitRegister_(store, actor, request); break;
      case "saveLearnerReview": result = saveLearnerReview_(store, actor, request); break;
      case "addStaffComment": result = addStaffComment_(store, actor, request); break;
      case "reviewHeaders": result = reviewHeaders_(store, actor, p); break;
      case "upload": result = upload_(store, actor, request); break;
      case "download": result = download_(store, actor, p); break;
      case "files": result = files_(store, actor, p); break;
      case "report": result = report_(store, actor, p); break;
      default: failure_("FORBIDDEN", "Unknown portal action.");
    }
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: { code: error.portalCode || "UNAVAILABLE", message: error.portalCode ? error.message : "The Google service is unavailable. Keep your draft and retry; ask the school owner if it continues.", details: error.portalDetails || null } };
  } finally { lock.releaseLock(); }
}
