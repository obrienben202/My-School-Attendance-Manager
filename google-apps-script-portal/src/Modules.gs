var PORTAL_VERSION = "1";
var PortalModules = {
  CalendarWeeks: ["Explicit Week A/B calendar", "Administration", "admin,hod,staff,office", "admin"],
  Students: ["Learners", "Academic", "admin,hod,staff,office,learner", "admin,office"],
  Courses: ["Courses", "Academic", "admin,hod,staff,office,learner", "admin,hod"],
  StudentEnrolments: ["Enrolments", "Academic", "admin,hod,staff,office,learner", "admin,hod,office"],
  LessonSchedules: ["Lesson timetable", "Academic", "admin,hod,staff,office,learner", "admin,hod"],
  StaffTimetableSlots: ["Staff timetable", "Academic", "admin,hod,staff,office", "admin,hod"],
  AttendanceMarks: ["Attendance", "Academic", "admin,hod,staff,office,learner", ""],
  DailyRegisters: ["Register submissions", "Academic", "admin,hod,staff,office", ""],
  RegisterAudit: ["Register history", "Academic", "admin,hod,staff,office", ""],
  Assessments: ["Assessments / markbook", "Assessment", "admin,hod,staff", "admin,hod,staff"],
  AssessmentResults: ["Assessment results", "Assessment", "admin,hod,staff", "admin,hod,staff"],
  MarkbookVerification: ["Markbook verification", "Assessment", "admin,hod,staff", "admin,hod,staff"],
  Targets: ["Targets", "Learner support", "admin,hod,office", "admin,hod,office"],
  PlannedAbsences: ["Planned absences", "Learner support", "admin,hod,staff,office", "admin,hod,staff,office"],
  ILPs: ["Individual learning plans", "ILP", "admin,hod,staff", "admin,hod,staff"],
  ILPGroups: ["ILP groups", "ILP", "admin,hod", "admin"],
  ReviewTemplates: ["Review templates", "ILP", "admin,hod", "admin"],
  ReviewTerms: ["Review terms", "ILP", "admin,hod", "admin"],
  LearnerAssignments: ["Learner / tutor links", "ILP", "admin,hod", "admin"],
  TermlyReviews: ["Termly reviews", "ILP", "admin,hod,staff,learner", "admin,hod,staff"],
  StaffComments: ["Shared staff comments", "ILP", "admin,hod,staff,office", ""],
  ILPSupportAudit: ["ILP support history", "ILP", "admin", ""],
  SafeguardingNotes: ["Safeguarding", "Restricted", "admin,hod,staff", "admin,hod,staff"],
  EProgressions: ["eProgressions", "Admissions", "admin,hod,office", "admin,hod,office"],
  ConciergeApplications: ["Applications / interviews", "Admissions", "admin,hod,office", "admin,hod,office"],
  AccountMappings: ["Verified account mappings", "Administration", "admin", ""],
  CourseAccess: ["Staff course access", "Administration", "admin", "admin"],
  DepartmentCourses: ["Department course links", "Administration", "admin", "admin"],
  KPIBenchmarks: ["KPI benchmarks", "Administration", "admin,hod,office", "admin"],
  Settings: ["Portal settings", "Administration", "admin", "admin"]
};
var PortalUnique = {
  Students: [["personCode"]], Courses: [["code"]],
  AttendanceMarks: [["studentId", "scheduleId", "date"]],
  DailyRegisters: [["scheduleId", "date"]],
  CourseAccess: [["username", "courseId"]], DepartmentCourses: [["department", "courseId"]],
  StudentEnrolments: [["studentId", "courseId"]],
  AssessmentResults: [["studentId", "assessmentId", "attempt"]],
  MarkbookVerification: [["assessmentId"]],
  ReviewTemplates: [["term", "version"]], ReviewTerms: [["academicYear", "term"]],
  LearnerAssignments: [["studentId"], ["learnerUserId"]],
  TermlyReviews: [["studentId", "termId"]], ILPGroups: [["defaultYear"]]
};
var PortalSystemFields = ["id", "createdAt", "updatedAt", "revision", "authorUserId", "updatedBy", "updatedById", "createdById", "createdBy", "markedBy", "requestedBy", "verifiedBy", "at"];
function allowedRoles_(csv, role) { return csv.split(",").indexOf(role) !== -1; }
function failure_(code, message, details) {
  var error = new Error(message); error.portalCode = code; error.portalDetails = details || null; throw error;
}
function copy_(value) { return JSON.parse(JSON.stringify(value)); }
function active_(row) { return !row._deleted; }
function equalId_(a, b) { return String(a == null ? "" : a) === String(b == null ? "" : b); }
function string_(value) { return value == null ? "" : String(value); }
function normalUsername_(value) { return string_(value).trim().toLowerCase(); }
