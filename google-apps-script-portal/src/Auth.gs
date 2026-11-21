function role_(raw) {
  var key = string_(raw).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  var aliases = { admin: "admin", administrator: "admin", administrators: "admin", hr: "admin", hod: "hod", "head of department": "hod", "head of dept": "hod", staff: "staff", teacher: "staff", teachers: "staff", "teaching staff": "staff", office: "office", "office staff": "office", "admin office": "office", learner: "learner", student: "learner", students: "learner" };
  if (!Object.prototype.hasOwnProperty.call(aliases, key)) failure_("CONFIG", "School directory contains an unrecognised role. Access was refused.");
  return aliases[key];
}
function directoryRows_(audience, withPasswordHash) {
  var p = config_(), prefix = audience === "learner" ? "LEARNER" : "STAFF";
  var id = p[prefix + "_DIRECTORY_ID"], tab = p[prefix + "_DIRECTORY_TAB"];
  if (!id || !tab) failure_("CONFIG", "The school owner must configure the " + (audience === "learner" ? "learner" : "staff") + " account source.");
  var sheet;
  try { sheet = SpreadsheetApp.openById(id).getSheetByName(tab); } catch (_) { failure_("UNAVAILABLE", "The school account directory is unavailable. Keep your draft and retry; no cached identity authorised this request."); }
  if (!sheet) failure_("CONFIG", "The configured school directory tab is missing.");
  var count = sheet.getLastRow() - 1;
  if (count < 1 || count > 5000) failure_("CONFIG", "The account source is empty or exceeds its reviewed capacity.");
  var heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function(v) { return String(v).toLowerCase().replace(/[^a-z0-9]/g, ""); });
  var aliases = { username: ["username", "user", "login"], role: ["role", "accountrole", "userrole"],
    displayName: ["fullname", "name", "displayname"], department: ["department", "dept"],
    personCode: ["personcode", "studentcode", "learnercode"], active: ["active", "enabled"],
    email: ["email", "emailaddress"], phone: ["phone", "telephone"], jobTitle: ["jobtitle", "position"] };
  if (withPasswordHash) aliases.passwordHash = ["passwordhash", "bcrypthash"];
  var columns = {};
  Object.keys(aliases).forEach(function(key) {
    var index = heads.findIndex(function(h) { return aliases[key].indexOf(h) >= 0; });
    // Select only permitted columns. Plaintext password and unknown columns are never read.
    if (index >= 0) columns[key] = sheet.getRange(2, index + 1, count, 1).getDisplayValues().map(function(r) { return r[0]; });
  });
  if (!columns.username || (audience === "staff" && !columns.role)) failure_("CONFIG", "Required directory identity headers are missing.");
  var seen = {}, records = [];
  for (var i = 0; i < count; i++) {
    var username = normalUsername_(columns.username[i]);
    if (!username) continue;
    if (seen[username]) failure_("CONFIG", "Duplicate school account names must be resolved before sign-in.");
    seen[username] = true;
    var record = { username: username };
    Object.keys(columns).forEach(function(key) { if (key !== "username") record[key] = columns[key][i]; });
    var enabled = !columns.active || ["true", "yes", "1", "active"].indexOf(string_(record.active).toLowerCase().trim()) >= 0;
    record.active = enabled;
    record.role = audience === "learner" ? "learner" : role_(record.role);
    if (audience === "staff" && record.role === "learner") failure_("CONFIG", "Learner accounts must use the separate learner source.");
    records.push(record);
  }
  return records;
}
function directoryRecord_(audience, username, withHash) {
  var record = directoryRows_(audience, withHash).find(function(r) { return r.username === username; });
  if (!record || !record.active) failure_("AUTH", "Invalid account or password.");
  return record;
}
function publicUser_(account, directory) {
  return { id: account.id, username: account.username, displayName: directory.displayName || account.username,
    role: directory.role, studentId: account.studentId || null, department: directory.department || null,
    profile: { email: directory.email || null, phone: directory.phone || null, jobTitle: directory.jobTitle || null }, verifiedAt: now_() };
}
function checkMapping_(store, audience, source) {
  var maps = store.rows("AccountMappings").filter(function(r) { return active_(r) && r.active !== false && r.audience === audience && normalUsername_(r.username) === source.username; });
  if (maps.length !== 1 || maps[0].role !== source.role) failure_("AUTH", "This account needs an authorised directory sync before sign-in.");
  var map = maps[0];
  if (audience === "learner") {
    var students = store.rows("Students").filter(function(r) { return active_(r) && !!source.personCode && equalId_(r.personCode, source.personCode); });
    if (students.length !== 1 || !equalId_(students[0].id, map.studentId)) failure_("AUTH", "Your learner account is not linked to a verified student record.");
  }
  return map;
}
function loginRate_(username) {
  var cache = CacheService.getScriptCache(), minute = Math.floor(Date.now() / 60000);
  var globalKey = "login-minute-" + minute, userKey = "login-user-" + digest_(username);
  var globalCount = Number(cache.get(globalKey)) || 0, userCount = Number(cache.get(userKey)) || 0;
  if (globalCount >= 60 || userCount >= 6) failure_("BUSY", "Too many sign-in attempts. Please wait ten minutes before trying again.");
  cache.put(globalKey, String(globalCount + 1), 120);
  cache.put(userKey, String(userCount + 1), 600);
}
function login_(store, payload) {
  var audience = payload.audience;
  if (audience !== "staff" && audience !== "learner") failure_("VALIDATION", "Choose staff or learner sign-in.");
  var username = normalUsername_(payload.username), password = payload.password;
  if (!username || username.length > 120 || typeof password !== "string" || !password || password.length > 500) failure_("AUTH", "Invalid account or password.");
  loginRate_(audience + ":" + username);
  var p = config_(), verifier = p[(audience === "learner" ? "LEARNER" : "STAFF") + "_AUTH_URL"];
  var source = directoryRecord_(audience, username, audience === "learner" && !verifier);
  var account = checkMapping_(store, audience, source), verified = false;
  if (verifier) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(verifier)) failure_("CONFIG", "Use the approved school Apps Script verifier URL.");
    try {
      var response = UrlFetchApp.fetch(verifier, { method: "post", payload: { username: username, password: password }, muteHttpExceptions: true, followRedirects: true });
      verified = response.getResponseCode() === 200 && JSON.parse(response.getContentText()).success === true;
    } catch (_) { failure_("AUTH", "School sign-in is temporarily unavailable. No local password fallback was used."); }
  } else if (audience === "learner") {
    if (!/^\$2[aby]\$1[0-4]\$/.test(string_(source.passwordHash))) failure_("CONFIG", "Learner sign-in needs an approved verifier or a supported bcrypt hash in its private source.");
    // bcryptjs is bundled with its licence; no custom password hashing algorithm.
    verified = bcrypt.compareSync(password, source.passwordHash);
  } else failure_("CONFIG", "The staff school-login verifier has not been configured.");
  if (!verified) failure_("AUTH", "Invalid account or password.");
  var raw = token_(), expires = new Date(Date.now() + Math.min(480, Math.max(15, Number(p.SESSION_MINUTES) || 60)) * 60000).toISOString();
  store.rows("SessionRecords").filter(function(s) { return s.accountId === account.id && !s.revoked; }).slice(0, -4).forEach(function(s) { s.revoked = true; store.put("SessionRecords", s); });
  store.put("SessionRecords", newRow_({ tokenHash: digest_(raw), accountId: account.id, username: username, audience: audience, expiresAt: expires, revoked: false }));
  return { token: raw, expiresAt: expires, user: publicUser_(account, source) };
}
function authenticate_(store, raw) {
  if (typeof raw !== "string" || raw.length > 200 || raw.length < 32) failure_("AUTH", "Please sign in again.");
  var session = store.rows("SessionRecords").find(function(s) { return s.tokenHash === digest_(raw) && !s.revoked && Date.parse(s.expiresAt) > Date.now(); });
  if (!session) failure_("AUTH", "Your session expired. Please sign in again.");
  var source = directoryRecord_(session.audience, session.username, false);
  var account = checkMapping_(store, session.audience, source);
  if (!equalId_(account.id, session.accountId)) failure_("AUTH", "Please sign in again.");
  return publicUser_(account, source);
}
