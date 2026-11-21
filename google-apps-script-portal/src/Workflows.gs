function liveEnrolment_(row) {
  return active_(row) && !/^(withdrawn|completed|inactive|cancelled|left)$/i.test(string_(row.status));
}
function occurrence_(store, actor, payload, editing) {
  var lesson = authorised_(store, "LessonSchedules", payload.scheduleId, actor, false);
  var course = find_(store, "Courses", lesson.courseId);
  if (!course || course.isActive === false || lesson.isActive === false) failure_("VALIDATION", "This course or lesson has been retired.");
  if (actor.role === "learner" || (editing && (actor.role === "office" || courseIds_(store, actor, true).indexOf(String(lesson.courseId)) < 0))) failure_("FORBIDDEN", "You cannot submit this register.");
  dateOnly_(payload.date);
  var day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(payload.date + "T12:00:00Z").getUTCDay()];
  if (!lesson.day || lesson.day !== day) failure_("VALIDATION", "This lesson is not scheduled on the selected day. No Monday default was applied.");
  if (lesson.weekPattern && lesson.weekPattern !== "Every week") {
    var monday = new Date(payload.date + "T12:00:00Z"), n = monday.getUTCDay();
    monday.setUTCDate(monday.getUTCDate() - (n === 0 ? 6 : n - 1));
    var calendar = store.rows("CalendarWeeks").find(function(r) { return active_(r) && r.weekStart === monday.toISOString().slice(0, 10); });
    if (!calendar || calendar.pattern !== lesson.weekPattern) failure_("VALIDATION", "This date needs an explicitly recorded matching Week A/B calendar entry.");
  }
  var ids = store.rows("StudentEnrolments").filter(function(e) { return liveEnrolment_(e) && equalId_(e.courseId, course.id); }).map(function(e) { return String(e.studentId); });
  var learners = store.rows("Students").filter(function(s) { return active_(s) && ids.indexOf(String(s.id)) >= 0; }).map(function(s) {
    return { studentId: s.id, displayName: [s.forename, s.surname].filter(Boolean).join(" "), personCode: s.personCode };
  });
  var saved = store.rows("DailyRegisters").find(function(r) { return active_(r) && equalId_(r.scheduleId, lesson.id) && r.date === payload.date; });
  return { lesson: lesson, course: course, students: learners, saved: saved };
}
function register_(store, actor, payload) {
  var o = occurrence_(store, actor, payload, false);
  var marks = store.rows("AttendanceMarks").filter(function(m) { return active_(m) && equalId_(m.scheduleId, o.lesson.id) && m.date === payload.date; });
  return { register: Object.assign({ _revision: 0, status: "open" }, o.saved ? publicRecord_(store, "DailyRegisters", o.saved, actor) : {}, { courseName: o.course.name }),
    students: o.students, marks: marks.map(function(m) { return { studentId: m.studentId, status: m.status, notes: m.notes || "" }; }),
    canSubmit: actor.role !== "office" && courseIds_(store, actor, true).indexOf(String(o.course.id)) >= 0 };
}
function submitRegister_(store, actor, request) {
  var p = request.payload, o = occurrence_(store, actor, p, true);
  version_(o.saved, p.expectedRevision, store, "DailyRegisters", actor);
  if (!Array.isArray(p.marks) || p.marks.length !== o.students.length || !p.marks.length || p.marks.length > 200) failure_("VALIDATION", "Submit exactly one mark for every enrolled learner (maximum 200).");
  var seen = {}, plan = [], allowed = ["Present", "Absent", "Late", "Authorised", "Not Marked"];
  p.marks.forEach(function(mark) {
    var id = String(mark.studentId);
    if (seen[id] || !o.students.some(function(s) { return equalId_(s.studentId, id); }) || allowed.indexOf(mark.status) < 0) failure_("VALIDATION", "Register contains a duplicate, unassigned learner or invalid mark.");
    seen[id] = true;
    if (mark.status === "Not Marked") failure_("VALIDATION", "Complete every attendance mark before submitting.");
    if (string_(mark.notes).length > 2000) failure_("VALIDATION", "Attendance notes must be 2,000 characters or fewer.");
    var previous = store.rows("AttendanceMarks").find(function(m) { return active_(m) && equalId_(m.studentId, id) && equalId_(m.scheduleId, o.lesson.id) && m.date === p.date; });
    var row = previous ? copy_(previous) : newRow_({ studentId: id, courseId: o.course.id, scheduleId: o.lesson.id, date: p.date, createdAt: now_() });
    row.status = mark.status; row.notes = string_(mark.notes); row.markedBy = actor.username; row.updatedAt = now_(); row._updatedAt = now_();
    row._revision = previous ? previous._revision + 1 : 1;
    validate_(store, "AttendanceMarks", row);
    plan.push({ entity: "AttendanceMarks", record: row });
  });
  var reg = o.saved ? copy_(o.saved) : newRow_({ scheduleId: o.lesson.id, date: p.date, createdAt: now_() });
  reg.status = "submitted"; reg.updatedBy = actor.username; reg.updatedAt = now_(); reg.submittedAt = now_(); reg._revision = o.saved ? o.saved._revision + 1 : 1; reg._updatedAt = now_();
  plan.push({ entity: "DailyRegisters", record: reg });
  plan.push({ entity: "RegisterAudit", record: newRow_({ scheduleId: o.lesson.id, date: p.date, action: o.saved ? "resubmitted" : "submitted", userId: actor.id, details: p.marks.length + " marks saved", createdAt: now_() }) });
  return commit_(store, actor, request, plan, { register: publicRecord_(store, "DailyRegisters", reg, actor), marksSaved: p.marks.length });
}
function reviewWork_(work, template, submitting) {
  if (!work || typeof work !== "object" || Array.isArray(work)) failure_("VALIDATION", "Review work must contain answers, summary and targets.");
  if (Object.keys(work).some(function(k) { return ["answers", "summary", "targets", "priorTargetUpdates"].indexOf(k) < 0; })) failure_("VALIDATION", "Unknown review-work field.");
  var answers = work.answers || {}, valid = [];
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) failure_("VALIDATION", "Answers must be a question-to-text mapping.");
  ((template && template.sections) || []).forEach(function(section) {
    (section.questions || []).forEach(function(q) {
      valid.push(String(q.id));
      if (submitting && q.required && !string_(answers[q.id]).trim()) failure_("VALIDATION", "Please answer every required review question.");
    });
  });
  Object.keys(answers).forEach(function(id) { if (valid.indexOf(id) < 0 || typeof answers[id] !== "string" || answers[id].length > 10000) failure_("VALIDATION", "An answer does not match this review template."); });
  if (typeof work.summary !== "string" || work.summary.length > 10000 || !Array.isArray(work.targets) || work.targets.length > 3) failure_("VALIDATION", "Review summary or targets are invalid.");
  if (work.targets.some(function(t) { return !t || typeof t !== "object" || Array.isArray(t); })) failure_("VALIDATION", "Each target must be a structured target.");
  if (new Set(work.targets.map(function(t) { return t.category; })).size !== work.targets.length) failure_("VALIDATION", "Use one target per category.");
  work.targets.forEach(function(t) {
    if (!t || ["academic", "personal", "future"].indexOf(t.category) < 0 || typeof t.description !== "string" || t.description.length > 10000 || typeof t.completed !== "boolean") failure_("VALIDATION", "Targets need category, description, steps, progress and completed fields.");
    if (Object.keys(t).some(function(k) { return ["category", "description", "steps", "progress", "completed"].indexOf(k) < 0; })) failure_("VALIDATION", "Unknown target field.");
    ["steps", "progress"].forEach(function(k) { if (typeof t[k] !== "string" || t[k].length > 10000) failure_("VALIDATION", "Invalid target " + k + "."); });
  });
  if (submitting) {
    if (!work.summary.trim()) failure_("VALIDATION", "Add a Summary of Discussion.");
    ["academic", "personal", "future"].forEach(function(category) {
      var target = work.targets.find(function(t) { return t.category === category; });
      if (!target || !target.description.trim() || !target.steps.trim()) failure_("VALIDATION", "Add the " + category + " target and actionable steps.");
    });
  }
  if (JSON.stringify(work).length > 200000) failure_("CAPACITY", "Review exceeds the reviewed storage capacity; nothing was truncated.");
}
function priorTargets_(store, review) {
  var term = find_(store, "ReviewTerms", review.termId);
  if (!term) return [];
  var terms = store.rows("ReviewTerms").filter(function(t) { return active_(t) && t.academicYear === term.academicYear && t.term < term.term; }).map(function(t) { return String(t.id); });
  var result = [];
  store.rows("TermlyReviews").filter(function(r) { return active_(r) && equalId_(r.studentId, review.studentId) && terms.indexOf(String(r.termId)) >= 0; }).forEach(function(r) {
    ((r.work && r.work.targets) || []).forEach(function(t) { result.push({ key: r.id + ":" + t.category, category: t.category, description: t.description, progress: t.progress, completed: t.completed }); });
  });
  return result;
}
function schoolToday_() { return Utilities.formatDate(new Date(), "Europe/London", "yyyy-MM-dd"); }
function saveLearnerReview_(store, actor, request) {
  var p = request.payload;
  if (actor.role !== "learner") failure_("FORBIDDEN", "This action is for the learner's own review.");
  var row = copy_(authorised_(store, "TermlyReviews", p.id, actor, false));
  version_(row, p.expectedRevision, store, "TermlyReviews", actor);
  if (["not_started", "draft", "returned"].indexOf(row.status) < 0) failure_("FORBIDDEN", "Submitted reviews are read-only until the tutor returns them.");
  var term = find_(store, "ReviewTerms", row.termId);
  if (!term || schoolToday_() < term.startDate) failure_("FORBIDDEN", "This review term has not opened yet.");
  var template = find_(store, "ReviewTemplates", row.templateId);
  if (!template || template.status !== "published") failure_("VALIDATION", "The assigned published template is unavailable.");
  reviewWork_(p.work, template.content, p.submit === true);
  var prior = priorTargets_(store, row), updates = p.work.priorTargetUpdates || {};
  if (!updates || typeof updates !== "object" || Array.isArray(updates) || Object.keys(updates).length > 100) failure_("VALIDATION", "Invalid earlier-target updates.");
  Object.keys(updates).forEach(function(key) {
    var update = updates[key];
    if (!prior.some(function(t) { return t.key === key; }) || !update || typeof update.progress !== "string" || update.progress.length > 10000 || typeof update.completed !== "boolean" || Object.keys(update).some(function(k) { return k !== "progress" && k !== "completed"; })) failure_("VALIDATION", "Earlier-target updates must refer only to your earlier term targets.");
  });
  row.work = copy_(p.work); row.status = p.submit === true ? "submitted" : "draft"; row._revision++; row.revision = row._revision; row.updatedAt = now_(); row._updatedAt = now_();
  row.history = (row.history || []).concat([{ action: p.submit === true ? "submitted" : "saved", actorId: actor.id, at: now_() }]);
  var result = publicRecord_(store, "TermlyReviews", row, actor);
  result.template = { content: template.content };
  result.priorTargets = prior;
  return commit_(store, actor, request, [{ entity: "TermlyReviews", record: row }], result);
}
function addStaffComment_(store, actor, request) {
  if (["admin", "hod", "staff", "office"].indexOf(actor.role) < 0) failure_("FORBIDDEN", "School staff access required.");
  var p = request.payload, comment = string_(p.comment).trim();
  if (!find_(store, "TermlyReviews", p.reviewId) || !comment || comment.length > 5000) failure_("VALIDATION", "Choose an existing review and a comment of 1–5,000 characters.");
  return commit_(store, actor, request, [{ entity: "StaffComments", record: newRow_({ reviewId: String(p.reviewId), comment: comment, authorUserId: actor.id, at: now_() }) }], { added: true });
}
function reviewHeaders_(store, actor, payload) {
  if (["admin", "hod", "staff", "office"].indexOf(actor.role) < 0) failure_("FORBIDDEN", "School staff access required.");
  var search = string_(payload.search).toLowerCase().slice(0, 100);
  var rows = store.rows("TermlyReviews").filter(active_).map(function(r) {
    var student = find_(store, "Students", r.studentId), template = find_(store, "ReviewTemplates", r.templateId);
    return { id: r.id, studentId: r.studentId, displayName: student ? [student.forename, student.surname].filter(Boolean).join(" ") : "Learner", title: template && template.content ? template.content.title : "Termly review" };
  }).filter(function(r) { return !search || (r.displayName + " " + r.title).toLowerCase().indexOf(search) >= 0; });
  var page = Math.max(1, Math.floor(Number(payload.page) || 1)), limit = Math.min(50, Math.max(1, Math.floor(Number(payload.limit) || 25)));
  return { rows: rows.slice((page - 1) * limit, page * limit), total: rows.length, page: page, limit: limit };
}
function dashboard_(store, actor) {
  var selected = ["Students", "Courses", "AttendanceMarks"];
  if (actor.role === "learner") selected.push("TermlyReviews");
  return { counts: selected.map(function(entity) { return { label: PortalModules[entity][0], value: store.rows(entity).filter(function(r) { return active_(r) && scope_(store, actor, entity, r, false) && (entity !== "Courses" || r.isActive !== false); }).length }; }),
    notices: ["Only records available to your account are counted.", "Source omissions never delete records automatically."] };
}
function report_(store, actor, payload) {
  if (["admin", "hod", "office"].indexOf(actor.role) < 0) failure_("FORBIDDEN", "Reports are restricted to authorised school roles.");
  var entity = { attendance: "AttendanceMarks", assessment: "AssessmentResults", enrolments: "StudentEnrolments" }[payload.kind];
  if (!entity || !allowedRoles_(module_(entity)[2], actor.role)) failure_("FORBIDDEN", "This report is not available to your role.");
  var fields = fieldsFor_(entity, actor).filter(function(f) { return f.type !== "json"; });
  var rows = store.rows(entity).filter(function(r) { return active_(r) && scope_(store, actor, entity, r, false); });
  if (rows.length > 2000) failure_("CAPACITY", "This report exceeds 2,000 rows. Ask the owner for a reviewed private archive/export.");
  return { columns: fields.map(function(f) { return { key: f.key, label: f.label }; }), rows: rows.map(function(r) { return publicRecord_(store, entity, r, actor); }) };
}
