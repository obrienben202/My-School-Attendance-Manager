function module_(entity) {
  if (!Object.prototype.hasOwnProperty.call(PortalModules, entity)) failure_("FORBIDDEN", "This record area is not available.");
  return PortalModules[entity];
}
function dateOnly_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(string_(value)) || new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value) failure_("VALIDATION", "Use a real calendar date in YYYY-MM-DD format.");
  return value;
}
function version_(current, expected, store, entity, actor) {
  if (!Number.isInteger(expected) || expected !== (current ? Number(current._revision) : 0)) {
    failure_("CONFLICT", "This record changed. Your draft has not been saved; review the latest version.", { current: current ? publicRecord_(store, entity, current, actor) : null });
  }
}
function validate_(store, entity, row) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(string_(row.id))) failure_("VALIDATION", "Record ID has an unsupported format.");
  PortalSchema[entity].fields.forEach(function(f) {
    var value = row[f.key];
    if (f.required && (value === null || value === undefined || value === "")) failure_("VALIDATION", f.label + " is required.");
    if (value === null || value === undefined || value === "") return;
    if (f.type === "number" && (typeof value !== "number" || !Number.isFinite(value) || (f.integer && !Number.isInteger(value)))) failure_("VALIDATION", f.label + " must be a valid " + (f.integer ? "whole number." : "number."));
    if (f.type === "boolean" && typeof value !== "boolean") failure_("VALIDATION", f.label + " must be true or false.");
    if (f.type === "text" && typeof value !== "string") failure_("VALIDATION", f.label + " must be text.");
    if (f.type === "date") dateOnly_(value);
    if (f.type === "datetime" && (!/^\d{4}-\d\d-\d\dT/.test(String(value)) || !Number.isFinite(Date.parse(value)))) failure_("VALIDATION", f.label + " must be an ISO timestamp.");
    if (f.references && !find_(store, f.references, value)) failure_("VALIDATION", f.label + " does not reference an active record.");
    if (JSON.stringify(value).length > 250000) failure_("CAPACITY", f.label + " exceeds the reviewed per-field storage capacity.");
  });
  var sets = (PortalUnique[entity] || []).concat(PortalSchema[entity].fields.filter(function(f) { return f.unique && f.key !== "id"; }).map(function(f) { return [f.key]; }));
  sets.forEach(function(keys) {
    if (keys.some(function(k) { return row[k] === null || row[k] === undefined || row[k] === ""; })) return;
    if (store.rows(entity).some(function(other) { return active_(other) && !equalId_(other.id, row.id) && keys.every(function(k) { return equalId_(other[k], row[k]); }); })) failure_("VALIDATION", "A record already exists for " + keys.join(", ") + ".");
  });
  if (entity === "LessonSchedules" || entity === "StaffTimetableSlots") {
    if (!/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(row.day || "") && row.day != null && row.day !== "") failure_("VALIDATION", "Choose a valid day or leave an unscheduled lesson blank.");
    if (!/^\d\d:\d\d$/.test(row.startTime || "") || !/^\d\d:\d\d$/.test(row.endTime || "") || row.startTime >= row.endTime || row.endTime > "23:59" || row.startTime.slice(3) > "59" || row.endTime.slice(3) > "59") failure_("VALIDATION", "Enter valid start/end times in HH:MM order.");
    if (row.weekPattern && ["Every week", "Week A", "Week B"].indexOf(row.weekPattern) < 0) failure_("VALIDATION", "Use an explicit Every week, Week A or Week B pattern.");
  }
  if (entity === "ILPGroups") {
    if (!Array.isArray(row.filters) || row.filters.some(function(f) { return f.field !== "Year Group" || ["equals", "is not"].indexOf(f.operator) < 0 || !/^(7|8|9|10|11)$/.test(String(f.value)); })) failure_("VALIDATION", "ILP groups require supported Year Group filters.");
    if (row.defaultYear != null && (!Number.isInteger(row.defaultYear) || row.defaultYear < 7 || row.defaultYear > 11)) failure_("VALIDATION", "Default year must be 7 to 11.");
  }
  if (entity === "AssessmentResults") {
    var assessment = find_(store, "Assessments", row.assessmentId);
    if (!assessment || !store.rows("StudentEnrolments").some(function(e) { return active_(e) && equalId_(e.studentId, row.studentId) && equalId_(e.courseId, assessment.courseId); })) failure_("VALIDATION", "The learner is not enrolled on this assessment's course.");
  }
  if (entity === "ReviewTerms") {
    dateOnly_(row.startDate); dateOnly_(row.endDate); dateOnly_(row.deadline);
    if (row.startDate > row.endDate || row.deadline < row.startDate || row.deadline > row.endDate) failure_("VALIDATION", "Review dates and deadline must be within the term.");
  }
  if (entity === "Settings" && ["schoolName", "academicYear", "helpText"].indexOf(row.key) < 0) failure_("FORBIDDEN", "Deployment settings can only be configured by the school owner.");
  if (entity === "CalendarWeeks" && (new Date(row.weekStart + "T12:00:00Z").getUTCDay() !== 1 || ["Week A", "Week B"].indexOf(row.pattern) < 0)) failure_("VALIDATION", "Record a Monday and an explicit Week A or Week B pattern.");
  if (entity === "ReviewTemplates" && ["draft", "published", "retired"].indexOf(row.status) < 0) failure_("VALIDATION", "Invalid template status.");
  if (entity === "ReviewTemplates") {
    var content = row.content, questionIds = {};
    if (!content || typeof content !== "object" || !Array.isArray(content.sections) || !content.sections.length) failure_("VALIDATION", "Templates need sections and questions.");
    content.sections.forEach(function(section) {
      if (!section.id || !Array.isArray(section.questions) || !section.questions.length) failure_("VALIDATION", "Every template section needs questions.");
      section.questions.forEach(function(q) {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(string_(q.id)) || questionIds[q.id] || !string_(q.prompt).trim() || typeof q.required !== "boolean") failure_("VALIDATION", "Template question IDs/prompts must be unique and complete.");
        questionIds[q.id] = true;
      });
    });
  }
  if (entity === "TermlyReviews") {
    var term = find_(store, "ReviewTerms", row.termId), template = find_(store, "ReviewTemplates", row.templateId);
    if (!term || !template || !equalId_(term.templateId, row.templateId) || template.status !== "published") failure_("VALIDATION", "Assign the term's published canonical template.");
    if (["not_started", "draft", "returned", "submitted", "reviewed"].indexOf(row.status) < 0) failure_("VALIDATION", "Invalid review status.");
    reviewWork_(row.work, template.content, ["submitted", "reviewed"].indexOf(row.status) >= 0);
    if (row.status === "reviewed" && (!string_(row.teacherComment).trim() || !row.reviewDate)) failure_("VALIDATION", "Completing a review requires teacher feedback and a review date.");
    if (row.status === "returned" && !string_(row.teacherComment).trim()) failure_("VALIDATION", "Explain what the learner should revise.");
  }
}
function list_(store, actor, payload) {
  var entity = payload.entity; module_(entity);
  var rows = store.rows(entity).filter(function(r) { return active_(r) && scope_(store, actor, entity, r, false); }).map(function(r) { return publicRecord_(store, entity, r, actor); });
  var search = string_(payload.search).toLowerCase().slice(0, 100);
  if (search) rows = rows.filter(function(r) { return JSON.stringify(r).toLowerCase().indexOf(search) >= 0; });
  var fields = fieldsFor_(entity, actor).map(function(f) { return f.key; });
  Object.keys(payload.filters || {}).forEach(function(key) {
    if (fields.indexOf(key) < 0) failure_("VALIDATION", "Unsupported filter.");
    rows = rows.filter(function(r) { return equalId_(r[key], payload.filters[key]); });
  });
  var page = Math.max(1, Math.floor(Number(payload.page) || 1)), limit = Math.min(50, Math.max(1, Math.floor(Number(payload.limit) || 25)));
  return { rows: rows.slice((page - 1) * limit, page * limit), total: rows.length, page: page, limit: limit };
}
function get_(store, actor, payload) {
  module_(payload.entity);
  var row = authorised_(store, payload.entity, payload.id, actor, false), out = publicRecord_(store, payload.entity, row, actor);
  if (payload.entity === "TermlyReviews") {
    var template = find_(store, "ReviewTemplates", row.templateId);
    out.template = template ? { content: template.content } : null;
    out.priorTargets = priorTargets_(store, row);
    if (actor.role !== "learner") out.staffComments = store.rows("StaffComments").filter(function(c) { return active_(c) && equalId_(c.reviewId, row.id); }).map(function(c) { return { author: c.authorUserId, comment: c.comment }; });
  }
  return out;
}
function save_(store, actor, request) {
  var p = request.payload || {}, entity = p.entity, spec = module_(entity), input = p.record;
  if (!allowedRoles_(spec[3], actor.role) || !input || typeof input !== "object" || Array.isArray(input)) failure_("FORBIDDEN", "You cannot change this record area.");
  var current = input.id ? authorised_(store, entity, input.id, actor, true) : null;
  if (input.id) version_(current, p.expectedRevision, store, entity, actor);
  else if (entity === "Settings") failure_("FORBIDDEN", "Settings are provisioned by the owner.");
  if (current && entity === "ReviewTemplates" && current.status !== "draft") failure_("FORBIDDEN", "Published templates are immutable. Create a new version.");
  var record = current ? copy_(current) : newRow_({});
  var definitions = PortalSchema[entity].fields, permitted = fieldsFor_(entity, actor).filter(function(f) { return !f.readonly; }).map(function(f) { return f.key; });
  Object.keys(input).forEach(function(key) {
    if (key === "id" || key === "_revision") return;
    if (permitted.indexOf(key) < 0) failure_("FORBIDDEN", "A server-controlled field was included in the save.");
    record[key] = input[key] === "" ? null : input[key];
  });
  definitions.forEach(function(f) {
    if (record[f.key] === undefined && f.defaultValue !== undefined) record[f.key] = copy_(f.defaultValue);
    if (f.autoTime && (!current || f.key === "updatedAt")) record[f.key] = now_();
  });
  ["createdById", "authorUserId", "updatedById", "verifiedBy"].forEach(function(key) { if ((!current || key === "updatedById" || key === "verifiedBy") && definitions.some(function(f) { return f.key === key; })) record[key] = actor.id; });
  ["updatedBy", "createdBy", "markedBy", "submittedBy"].forEach(function(key) { if ((!current || (key !== "createdBy" && key !== "submittedBy")) && definitions.some(function(f) { return f.key === key; })) record[key] = actor.username; });
  if (definitions.some(function(f) { return f.key === "at"; })) record.at = now_();
  record._revision = current ? current._revision + 1 : 1; record._updatedAt = now_();
  if (definitions.some(function(f) { return f.key === "revision"; })) record.revision = record._revision;
  var plan = [];
  if (entity === "TermlyReviews") {
    if (actor.role !== "admin" && current && ((current.status !== "submitted" && record.status !== current.status) || ["submitted", "returned", "reviewed"].indexOf(record.status) < 0)) failure_("FORBIDDEN", "The assigned tutor can comment, return or complete a submitted review.");
    if (current && JSON.stringify(current.work) !== JSON.stringify(record.work)) {
      if (!string_(record.supportReason).trim() || string_(record.supportReason).length > 1000) failure_("VALIDATION", "Explain why you are changing learner answers (up to 1,000 characters).");
      plan.push({ entity: "ILPSupportAudit", record: newRow_({ actorId: actor.id, reviewId: record.id, action: "staff_support_edit", reason: record.supportReason, createdAt: now_() }) });
    }
    delete record.supportReason;
    if (!current) record.history = [];
    record.history = (record.history || []).concat([{ action: current && current.status !== record.status ? "status_" + record.status : "staff_saved", actorId: actor.id, at: now_() }]);
  }
  if (entity === "MarkbookVerification") {
    store.rows("AssessmentResults").filter(function(r) { return active_(r) && equalId_(r.assessmentId, record.assessmentId); }).forEach(function(r) {
      var result = copy_(r); result.confirmed = record.verified ? 1 : 0; result.gradeReleasedAt = record.verified ? now_() : null; result._revision++; result.updatedAt = now_(); result._updatedAt = now_();
      plan.push({ entity: "AssessmentResults", record: result });
    });
  }
  if (!current && entity === "Courses" && actor.role === "hod") {
    if (!actor.department) failure_("FORBIDDEN", "A verified department is required.");
    plan.push({ entity: "DepartmentCourses", record: newRow_({ department: actor.department, courseId: record.id }) });
  } else if (!scope_(store, actor, entity, record, true)) failure_("FORBIDDEN", "This record is outside your assignment or department.");
  validate_(store, entity, record);
  plan.unshift({ entity: entity, record: record });
  return commit_(store, actor, request, plan, publicRecord_(store, entity, record, actor));
}
function remove_(store, actor, request) {
  var p = request.payload, entity = p.entity;
  var m = modulesFor_(actor).find(function(v) { return v.id === entity; });
  if (!m || !m.canDelete) failure_("FORBIDDEN", "You cannot archive this record.");
  var row = copy_(authorised_(store, entity, p.id, actor, true));
  version_(row, p.expectedRevision, store, entity, actor);
  Object.keys(PortalSchema).forEach(function(other) {
    PortalSchema[other].fields.filter(function(f) { return f.references === entity; }).forEach(function(field) {
      if (store.rows(other).some(function(r) { return active_(r) && equalId_(r[field.key], row.id); })) failure_("VALIDATION", "Linked records must be resolved before archiving this record.");
    });
  });
  row._deleted = true; row._revision++; row._updatedAt = now_();
  return commit_(store, actor, request, [{ entity: entity, record: row }], { removed: true });
}
