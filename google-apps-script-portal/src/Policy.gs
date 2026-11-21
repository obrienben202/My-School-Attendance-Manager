function courseIds_(store, actor, editing) {
  if (actor.role === "admin" || (actor.role === "office" && !editing)) return store.rows("Courses").filter(active_).map(function(r) { return String(r.id); });
  if (actor.role === "learner") return store.rows("StudentEnrolments").filter(function(r) { return active_(r) && equalId_(r.studentId, actor.studentId); }).map(function(r) { return String(r.courseId); });
  if (actor.role === "hod") return store.rows("DepartmentCourses").filter(function(r) { return active_(r) && !!actor.department && r.department === actor.department; }).map(function(r) { return String(r.courseId); });
  return store.rows("CourseAccess").filter(function(r) { return active_(r) && normalUsername_(r.username) === actor.username && (!editing || r.canEdit === true); }).map(function(r) { return String(r.courseId); });
}
function studentIds_(store, actor, editing) {
  if (actor.role === "learner") return [String(actor.studentId)];
  if (actor.role === "admin" || actor.role === "office") return store.rows("Students").filter(active_).map(function(r) { return String(r.id); });
  var courses = courseIds_(store, actor, editing);
  return store.rows("StudentEnrolments").filter(function(r) { return active_(r) && courses.indexOf(String(r.courseId)) >= 0; }).map(function(r) { return String(r.studentId); });
}
function tutorFor_(store, actor, studentId) {
  return store.rows("LearnerAssignments").some(function(a) { return active_(a) && equalId_(a.studentId, studentId) && equalId_(a.tutorUserId, actor.id); });
}
function scope_(store, actor, entity, row, editing) {
  var spec = PortalModules[entity];
  if (!spec || !allowedRoles_(spec[editing ? 3 : 2], actor.role)) return false;
  if (actor.role === "admin") return true;
  if (entity === "AccountMappings" || entity === "CourseAccess" || entity === "DepartmentCourses" || entity === "Settings") return false;
  if (entity === "TermlyReviews") {
    if (actor.role !== "learner") return tutorFor_(store, actor, row.studentId);
    var student = find_(store, "Students", actor.studentId);
    return !!student && student.confirmedLearner === true && equalId_(row.studentId, actor.studentId) && store.rows("LearnerAssignments").some(function(a) { return active_(a) && equalId_(a.studentId, actor.studentId) && equalId_(a.learnerUserId, actor.id); });
  }
  if (entity === "ILPs") return tutorFor_(store, actor, row.studentId);
  if (entity === "SafeguardingNotes") return actor.role === "hod" ? studentIds_(store, actor, false).indexOf(String(row.studentId)) >= 0 : equalId_(row.authorUserId, actor.id);
  if (entity === "StaffComments") return true; // Shared staff discussion never includes private answers.
  if (entity === "CalendarWeeks") return !editing;
  if (entity === "ILPGroups" || entity === "ReviewTemplates" || entity === "ReviewTerms" || entity === "KPIBenchmarks") return !editing;
  if (entity === "LearnerAssignments") return tutorFor_(store, actor, row.studentId);
  if (entity === "StaffTimetableSlots") return row.staffUsername ? normalUsername_(row.staffUsername) === actor.username || (actor.role === "hod" && !!actor.department && row.department === actor.department) : actor.role === "hod" && row.isHodShared === true;
  if (entity === "Students") return studentIds_(store, actor, editing).indexOf(String(row.id)) >= 0;
  if (entity === "Courses") return courseIds_(store, actor, editing).indexOf(String(row.id)) >= 0;
  var courseId = row.courseId;
  if (entity === "AssessmentResults" || entity === "MarkbookVerification") {
    var assessment = find_(store, "Assessments", row.assessmentId);
    courseId = assessment && assessment.courseId;
  }
  if (entity === "DailyRegisters" || entity === "RegisterAudit") {
    var lesson = find_(store, "LessonSchedules", row.scheduleId);
    courseId = lesson && lesson.courseId;
  }
  if (actor.role === "learner" && row.studentId != null && !equalId_(row.studentId, actor.studentId)) return false;
  if (courseId != null && courseId !== "") return courseIds_(store, actor, editing).indexOf(String(courseId)) >= 0;
  if (row.studentId != null) return studentIds_(store, actor, editing).indexOf(String(row.studentId)) >= 0;
  // Office may manage applications not yet linked to a learner/course. Others fail closed.
  return actor.role === "office" && entity === "ConciergeApplications";
}
function fieldsFor_(entity, actor) {
  var fields = copy_(PortalSchema[entity].fields);
  var learnerFields = {
    Students: ["id", "personCode", "forename", "surname", "yearGroup", "formGroup"],
    Courses: ["id", "code", "name", "room", "staffName", "yearGroup", "academicYear", "isActive"],
    StudentEnrolments: ["id", "studentId", "courseId", "status"],
    AttendanceMarks: ["id", "studentId", "courseId", "scheduleId", "date", "status", "minutesLate"],
    LessonSchedules: ["id", "courseId", "day", "startTime", "endTime", "room", "weekPattern", "isActive"],
    TermlyReviews: ["id", "studentId", "termId", "templateId", "status", "work", "teacherComment", "reviewDate"]
  };
  if (actor.role === "learner") fields = fields.filter(function(f) { return (learnerFields[entity] || []).indexOf(f.key) >= 0; });
  if (actor.role === "staff" && entity === "Students") fields = fields.filter(function(f) { return ["id", "personCode", "forename", "surname", "yearGroup", "formGroup", "attendancePercent"].indexOf(f.key) >= 0; });
  fields.forEach(function(f) {
    if (f.type === "datetime") f.label += " (UTC)";
    if (f.references || /^(studentId|courseId|assessmentId|tutorUserId|learnerUserId|scheduleId|templateId|termId)$/.test(f.key)) f.type = "text";
    if (/content|notes|comment/i.test(f.key) && f.type === "text") f.type = "textarea";
    if (f.key === "revision" || PortalSystemFields.indexOf(f.key) >= 0) f.readonly = true;
    if (actor.role === "learner") f.readonly = true;
    if (entity === "TermlyReviews" && f.key === "work" && actor.role !== "admin") f.readonly = true;
    if (entity === "ReviewTemplates" && f.key === "status") { f.type = "select"; f.options = ["draft", "published", "retired"]; }
  });
  if (entity === "TermlyReviews" && actor.role === "admin") fields.push({ key: "supportReason", label: "Reason if changing learner answers", type: "textarea", required: false, readonly: false });
  return fields;
}
function publicRecord_(store, entity, row, actor) {
  var out = { id: row.id, _revision: row._revision };
  fieldsFor_(entity, actor).forEach(function(f) { if (row[f.key] !== undefined) out[f.key] = row[f.key]; });
  if (actor.role === "learner" && entity === "TermlyReviews" && ["returned", "reviewed"].indexOf(row.status) < 0) delete out.teacherComment;
  return out;
}
function authorised_(store, entity, id, actor, editing) {
  var row = find_(store, entity, id);
  if (!row || !scope_(store, actor, entity, row, editing)) failure_("NOT_FOUND", "Record not found or not available to your account.");
  return row;
}
function modulesFor_(actor) {
  return Object.keys(PortalModules).filter(function(id) { return allowedRoles_(PortalModules[id][2], actor.role); }).map(function(id) {
    var spec = PortalModules[id], editing = allowedRoles_(spec[3], actor.role);
    return { id: id, label: spec[0], section: spec[1], canCreate: editing && id !== "Settings",
      canEdit: editing, canDelete: editing && ["Settings", "ReviewTemplates", "ReviewTerms", "LearnerAssignments"].indexOf(id) < 0,
      fields: fieldsFor_(id, actor) };
  });
}
