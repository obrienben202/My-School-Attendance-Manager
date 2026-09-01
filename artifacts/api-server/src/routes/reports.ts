import { Router, type Request, type Response } from "express";
import { and, eq, ilike } from "drizzle-orm";
import {
  attendanceTable,
  attendanceRegisterAuditTable,
  attendanceRegistersTable,
  assessmentResultsTable,
  assessmentsTable,
  coursesTable,
  db,
  enrollmentsTable,
  ilpsTable,
  plannedAbsencesTable,
  safeguardingNotesTable,
  scheduleTable,
  studentsTable,
  targetsTable,
} from "@workspace/db";
import {
  GetReportParams,
} from "@workspace/api-zod";
import { canAccessReports } from "../lib/report-access";
import { canAccessSafeguarding } from "../lib/safeguarding-access";

const router = Router();

type ReportColumn = { key: string; label: string };
type ReportRow = string[];
type ReportId =
  | "att-overall" | "att-learner" | "att-course" | "att-punctuality" | "att-register-progress"
  | "asmt-grade-summary" | "asmt-results" | "asmt-unconfirmed"
  | "ilp-progress" | "ilp-reviews-due" | "ilp-completion"
  | "sg-at-risk" | "sg-planned-absence"
  | "mb-verification-status" | "mb-grades-released";
type ReportQuery = {
  academicYear?: string;
  dateFrom?: Date;
  dateTo?: Date;
  course?: string;
  surname?: string;
  threshold?: string;
  tutor?: string;
  unit?: string;
  overdueTo?: Date;
  status?: string;
  completion?: string;
};

export const REPORT_META: Record<ReportId, {
  title: string;
  description: string;
  columns: ReportColumn[];
}> = {
  "att-overall": {
    title: "Overall Attendance Summary",
    description: "Summary of attendance figures across all courses for a given period.",
    columns: [
      { key: "course", label: "Course" }, { key: "enrolled", label: "Enrolled" },
      { key: "averageAttendance", label: "Avg Attendance %" }, { key: "below80", label: "Below 80%" },
      { key: "below90", label: "Below 90%" },
    ],
  },
  "att-learner": {
    title: "Learner Attendance Detail",
    description: "Individual learner attendance breakdown by session.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "course", label: "Course" }, { key: "sessionsPossible", label: "Sessions Possible" },
      { key: "sessionsAttended", label: "Sessions Attended" }, { key: "attendance", label: "Attendance %" },
      { key: "punctuality", label: "Punctuality %" },
    ],
  },
  "att-course": {
    title: "Course Attendance by Date",
    description: "Session-by-session attendance for a specific course.",
    columns: [
      { key: "sessionDate", label: "Session Date" }, { key: "session", label: "Session" },
      { key: "present", label: "Present" }, { key: "absent", label: "Absent" },
      { key: "late", label: "Late" }, { key: "attendance", label: "Attendance %" },
    ],
  },
  "att-punctuality": {
    title: "Punctuality Report",
    description: "Learners with persistent lateness patterns.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "course", label: "Course" }, { key: "totalSessions", label: "Total Sessions" },
      { key: "lateSessions", label: "Late Sessions" }, { key: "latePercent", label: "Late %" },
    ],
  },
  "att-register-progress": {
    title: "Register Completion Overview",
    description: "Aggregated register save activity showing which saved registers still need completion.",
    columns: [
      { key: "course", label: "Course" }, { key: "sessionDate", label: "Session Date" },
      { key: "session", label: "Session" }, { key: "staff", label: "Staff" },
      { key: "latestSave", label: "Latest Save" }, { key: "completion", label: "Completion" },
      { key: "lastSaved", label: "Last Saved" },
    ],
  },
  "asmt-grade-summary": {
    title: "Grade Summary by Course",
    description: "Distribution of grades across assessments for a course.",
    columns: [
      { key: "course", label: "Course" }, { key: "unit", label: "Unit" },
      { key: "distinctionStar", label: "A* / Dist*" }, { key: "distinction", label: "A / Distinction" },
      { key: "merit", label: "B / Merit" }, { key: "pass", label: "C / Pass" },
      { key: "fail", label: "U / Fail" }, { key: "notGraded", label: "Not graded" },
    ],
  },
  "asmt-results": {
    title: "Assessment Results Detail",
    description: "Individual learner grades per assessment.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "unit", label: "Unit" }, { key: "grade", label: "Grade" },
      { key: "score", label: "Score" }, { key: "verified", label: "Verified" },
      { key: "released", label: "Released" },
    ],
  },
  "asmt-unconfirmed": {
    title: "Unconfirmed Assessments",
    description: "Assessments awaiting staff confirmation.",
    columns: [
      { key: "assessment", label: "Assessment" }, { key: "course", label: "Course" },
      { key: "dueDate", label: "Due Date" }, { key: "learnersUnconfirmed", label: "Learners Unconfirmed" },
      { key: "tutor", label: "Tutor" },
    ],
  },
  "ilp-progress": {
    title: "ILP Progress Summary",
    description: "Overview of ILP completion status across learners.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "tutor", label: "Tutor" }, { key: "status", label: "ILP Status" },
      { key: "lastReview", label: "Last Review" }, { key: "nextReviewDue", label: "Next Review Due" },
      { key: "targetsSet", label: "Targets Set" },
    ],
  },
  "ilp-reviews-due": {
    title: "ILP Reviews Due",
    description: "Learners whose ILP review is due or overdue.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "tutor", label: "Tutor" }, { key: "reviewDueDate", label: "Review Due Date" },
      { key: "daysOverdue", label: "Days Overdue" },
    ],
  },
  "ilp-completion": {
    title: "ILP Section Completion",
    description: "Completion rates for each ILP section.",
    columns: [
      { key: "section", label: "ILP Section" }, { key: "totalLearners", label: "Total Learners" },
      { key: "completed", label: "Completed" }, { key: "partial", label: "Partial" },
      { key: "notStarted", label: "Not Started" }, { key: "completion", label: "Completion %" },
    ],
  },
  "sg-at-risk": {
    title: "At-Risk Learners",
    description: "Learners flagged as at-risk based on attendance and progress.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "course", label: "Course" }, { key: "attendance", label: "Attendance %" },
      { key: "flags", label: "Flags" }, { key: "lastContacted", label: "Last Contacted" },
    ],
  },
  "sg-planned-absence": {
    title: "Planned Absence Summary",
    description: "Summary of planned absence requests and approval statuses.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "reason", label: "Reason" }, { key: "from", label: "From" },
      { key: "to", label: "To" }, { key: "status", label: "Status" },
    ],
  },
  "mb-verification-status": {
    title: "Markbook Verification Status",
    description: "Current verification status of markbook grades per unit.",
    columns: [
      { key: "course", label: "Course" }, { key: "unit", label: "Unit" },
      { key: "totalLearners", label: "Total Learners" }, { key: "graded", label: "Graded" },
      { key: "verified", label: "Verified" }, { key: "released", label: "Released" },
      { key: "verifiedPercent", label: "% Verified" },
    ],
  },
  "mb-grades-released": {
    title: "Grades Released to Learners",
    description: "Report of all grades that have been released to learners.",
    columns: [
      { key: "learner", label: "Learner" }, { key: "personCode", label: "Person Code" },
      { key: "unit", label: "Unit" }, { key: "grade", label: "Grade" },
      { key: "releasedOn", label: "Released On" },
    ],
  },
};

const FILTERS_BY_REPORT: Record<ReportId, Set<keyof ReportQuery>> = {
  "att-overall": new Set(["academicYear", "dateFrom", "dateTo", "course"]),
  "att-learner": new Set(["academicYear", "surname", "course", "dateFrom", "dateTo"]),
  "att-course": new Set(["course", "dateFrom", "dateTo"]),
  "att-punctuality": new Set(["academicYear", "threshold"]),
  "att-register-progress": new Set(["dateFrom", "dateTo", "course", "status", "completion"]),
  "asmt-grade-summary": new Set(["course", "academicYear"]),
  "asmt-results": new Set(["course", "unit", "academicYear"]),
  "asmt-unconfirmed": new Set(["tutor", "course"]),
  "ilp-progress": new Set(["academicYear", "tutor"]),
  "ilp-reviews-due": new Set(["tutor", "overdueTo"]),
  "ilp-completion": new Set(["academicYear"]),
  "sg-at-risk": new Set(["threshold", "course"]),
  "sg-planned-absence": new Set(["dateFrom", "dateTo", "status"]),
  "mb-verification-status": new Set(["course", "academicYear"]),
  "mb-grades-released": new Set(["course", "dateFrom", "dateTo"]),
};

function asDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

function queryValue(query: Request["query"], key: keyof ReportQuery): string | undefined {
  const value = query[key];
  return typeof value === "string" ? value : undefined;
}

export function parseQuery(req: Request, reportId: ReportId): { data?: ReportQuery; error?: string } {
  const raw = {
    academicYear: queryValue(req.query, "academicYear"),
    dateFrom: queryValue(req.query, "dateFrom"),
    dateTo: queryValue(req.query, "dateTo"),
    course: queryValue(req.query, "course"),
    surname: queryValue(req.query, "surname"),
    threshold: queryValue(req.query, "threshold"),
    tutor: queryValue(req.query, "tutor"),
    unit: queryValue(req.query, "unit"),
    overdueTo: queryValue(req.query, "overdueTo"),
    status: queryValue(req.query, "status"),
    completion: queryValue(req.query, "completion"),
  };
  const knownKeys = new Set(Object.keys(raw));
  const unknownKey = Object.keys(req.query).find((key) => !knownKeys.has(key));
  if (unknownKey) return { error: `Unknown report filter: ${unknownKey}` };
  const inapplicableKey = Object.keys(req.query).find((key) => !FILTERS_BY_REPORT[reportId].has(key as keyof ReportQuery));
  if (inapplicableKey) return { error: `${inapplicableKey} is not a filter for ${REPORT_META[reportId].title}` };
  if (Object.entries(req.query).some(([, value]) => typeof value !== "string")) {
    return { error: "Each report filter must be a single value" };
  }
  const dateFrom = raw.dateFrom ? asDate(raw.dateFrom) : undefined;
  const dateTo = raw.dateTo ? asDate(raw.dateTo) : undefined;
  const overdueTo = raw.overdueTo ? asDate(raw.overdueTo) : undefined;
  if ((raw.dateFrom && !dateFrom) || (raw.dateTo && !dateTo) || (raw.overdueTo && !overdueTo)) {
    return { error: "Report dates must use valid YYYY-MM-DD values" };
  }
  if (dateFrom && dateTo && dateFrom > dateTo) return { error: "Date From must be before Date To" };
  if (raw.academicYear && !/^\d{4}\/\d{2}$/.test(raw.academicYear)) {
    return { error: "Academic Year must use YYYY/YY" };
  }
  if (raw.threshold) {
    const validThreshold = reportId === "att-punctuality"
      ? /^(3|5|10)\+$/.test(raw.threshold)
      : /^(70|75|80)%$/.test(raw.threshold);
    if (!validThreshold) return { error: "Invalid threshold for this report" };
  }
  if (raw.status && reportId === "sg-planned-absence" && !["all", "awaiting decision", "approved", "declined"].includes(raw.status.toLowerCase())) {
    return { error: "Invalid planned absence status" };
  }
  if (raw.status && reportId === "att-register-progress" && !["all", "draft", "submitted"].includes(raw.status.toLowerCase())) {
    return { error: "Invalid register save status" };
  }
  if (raw.completion && reportId === "att-register-progress" && !["all", "unmarked", "unmarked rows", "fully marked"].includes(raw.completion.toLowerCase())) {
    return { error: "Invalid register completion filter" };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.length > 200) return { error: `${key} is too long` };
  }
  return {
    data: {
      academicYear: raw.academicYear || undefined, dateFrom, dateTo, course: raw.course || undefined,
      surname: raw.surname || undefined, threshold: raw.threshold || undefined, tutor: raw.tutor || undefined,
      unit: raw.unit || undefined, overdueTo, status: raw.status || undefined, completion: raw.completion || undefined,
    },
  };
}

function filterText(value: string | null | undefined, filter?: string) {
  return !filter || filter.toLowerCase() === "all" || filter.toLowerCase() === "all courses"
    || (value ?? "").toLowerCase().includes(filter.toLowerCase());
}

function dateInRange(value: string, query: ReportQuery) {
  return (!query.dateFrom || value >= query.dateFrom.toISOString().slice(0, 10))
    && (!query.dateTo || value <= query.dateTo.toISOString().slice(0, 10));
}

function percentage(numerator: number, denominator: number) {
  return denominator === 0 ? "0.0%" : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function filterLabel(query: ReportQuery) {
  return Object.fromEntries(Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, value instanceof Date ? value.toISOString().slice(0, 10) : String(value)]));
}

type ReportData = { rows: ReportRow[]; asOf: Date | null };

export function registerCompletionFromDetails(
  details: string,
  enrolledCount: number,
): "Unmarked rows" | "Fully marked" | null {
  const markedCount = Number(details.match(/(\d+)\s+learner mark/)?.[1]);
  if (!Number.isFinite(markedCount)) return null;
  return markedCount === enrolledCount ? "Fully marked" : "Unmarked rows";
}

export function latestTimestamp(values: Array<Date | null | undefined>): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
}

function displayDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function daysOverdue(dueDate: string, today: string): number {
  const milliseconds = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}

export function isProgressRisk(target: { completed: boolean; dueDate: string | null }, today: string): boolean {
  return !target.completed && target.dueDate !== null && target.dueDate < today;
}

async function attendanceRows(reportId: ReportId, query: ReportQuery): Promise<ReportRow[]> {
  const enrollments = await db.select({
    courseId: enrollmentsTable.courseId,
    studentId: enrollmentsTable.studentId,
  }).from(enrollmentsTable);
  const records = await db.select({
    date: attendanceTable.date,
    status: attendanceTable.status,
    minutesLate: attendanceTable.minutesLate,
    studentId: studentsTable.id,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
    courseId: coursesTable.id,
    courseName: coursesTable.name,
    academicYear: coursesTable.academicYear,
    scheduleId: scheduleTable.id,
    scheduleDay: scheduleTable.day,
  }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(attendanceTable.courseId, coursesTable.id))
    .leftJoin(scheduleTable, eq(attendanceTable.scheduleId, scheduleTable.id));
  const filtered = records.filter((record) =>
    filterText(record.academicYear, query.academicYear)
    && filterText(record.courseName, query.course)
    && (!query.surname || record.surname.toLowerCase().includes(query.surname.toLowerCase()))
    && dateInRange(record.date, query));

  if (reportId === "att-overall") {
    const groups = new Map<number, typeof filtered>();
    filtered.forEach((record) => groups.set(record.courseId, [...(groups.get(record.courseId) ?? []), record]));
    return [...groups.values()].map((group) => {
      const byStudent = new Map<number, typeof group>();
      group.forEach((record) => byStudent.set(record.studentId, [...(byStudent.get(record.studentId) ?? []), record]));
      const attendance = [...byStudent.values()].map((studentRecords) =>
        studentRecords.filter((record) => record.status === "present" || record.status === "late").length / studentRecords.length);
      return [
        group[0].courseName,
        String(new Set(enrollments.filter((enrollment) => enrollment.courseId === group[0].courseId).map((enrollment) => enrollment.studentId)).size),
        percentage(attendance.reduce((sum, value) => sum + value, 0), attendance.length),
        String(attendance.filter((value) => value < 0.8).length),
        String(attendance.filter((value) => value < 0.9).length),
      ];
    }).sort((a, b) => a[0].localeCompare(b[0]));
  }

  if (reportId === "att-learner" || reportId === "att-punctuality") {
    const groups = new Map<string, typeof filtered>();
    filtered.forEach((record) => {
      const key = `${record.studentId}:${record.courseId}`;
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });
    return [...groups.values()].filter((group) => {
      if (reportId !== "att-punctuality") return true;
      const threshold = Number(query.threshold?.match(/\d+/)?.[0] ?? 0);
      return group.filter((record) => record.status === "late" || (record.minutesLate ?? 0) > 0).length >= threshold;
    }).map((group) => {
      const attended = group.filter((record) => record.status === "present" || record.status === "late").length;
      const late = group.filter((record) => record.status === "late" || (record.minutesLate ?? 0) > 0).length;
      const name = `${group[0].surname}, ${group[0].forename}`;
      if (reportId === "att-punctuality") return [
        name, group[0].personCode, group[0].courseName, String(group.length), String(late), percentage(late, group.length),
      ];
      return [
        name, group[0].personCode, group[0].courseName, String(group.length), String(attended),
        percentage(attended, group.length), percentage(attended - late, attended),
      ];
    }).sort((a, b) => a[0].localeCompare(b[0]));
  }

  const groups = new Map<string, typeof filtered>();
  filtered.forEach((record) => {
    const key = `${record.date}:${record.scheduleId ?? "legacy"}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return [...groups.values()].map((group) => {
    const present = group.filter((record) => record.status === "present").length;
    const late = group.filter((record) => record.status === "late" || (record.minutesLate ?? 0) > 0).length;
    const absent = group.filter((record) => record.status === "absent").length;
    return [
      group[0].date, group[0].scheduleDay ?? "Course session", String(present), String(absent), String(late),
      percentage(present + late, group.length),
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]));
}

async function registerProgressData(query: ReportQuery): Promise<ReportData> {
  const [events, enrollments] = await Promise.all([
    db.select({
      scheduleId: attendanceRegisterAuditTable.scheduleId,
      date: attendanceRegisterAuditTable.date,
      action: attendanceRegisterAuditTable.action,
      details: attendanceRegisterAuditTable.details,
      createdAt: attendanceRegisterAuditTable.createdAt,
      courseId: coursesTable.id,
      courseName: coursesTable.name,
      day: scheduleTable.day,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      staffName: scheduleTable.staffName,
      registerStatus: attendanceRegistersTable.status,
    })
      .from(attendanceRegisterAuditTable)
      .innerJoin(scheduleTable, eq(attendanceRegisterAuditTable.scheduleId, scheduleTable.id))
      .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
      .leftJoin(attendanceRegistersTable, and(
        eq(attendanceRegistersTable.scheduleId, attendanceRegisterAuditTable.scheduleId),
        eq(attendanceRegistersTable.date, attendanceRegisterAuditTable.date),
      )),
    db.select({
      courseId: enrollmentsTable.courseId,
      studentId: enrollmentsTable.studentId,
    }).from(enrollmentsTable),
  ]);

  const enrolledByCourse = new Map<number, Set<number>>();
  enrollments.forEach(({ courseId, studentId }) => {
    const students = enrolledByCourse.get(courseId) ?? new Set<number>();
    students.add(studentId);
    enrolledByCourse.set(courseId, students);
  });

  const latestByOccurrence = new Map<string, typeof events[number]>();
  events
    .filter((event) => ["saved_draft", "submitted"].includes(event.action.toLowerCase()))
    .forEach((event) => {
    const key = `${event.scheduleId}:${event.date}`;
    const current = latestByOccurrence.get(key);
    if (!current || event.createdAt > current.createdAt) latestByOccurrence.set(key, event);
    });

  const rows = [...latestByOccurrence.values()]
    .map((event) => {
      const completion = registerCompletionFromDetails(
        event.details,
        enrolledByCourse.get(event.courseId)?.size ?? 0,
      );
      const isSubmitted = event.registerStatus?.toLowerCase() === "submitted";
      return {
        event,
        completion,
        latestSave: isSubmitted ? "Final submitted" : "Draft saved",
      };
    })
    .filter(({ event, completion, latestSave }) =>
      dateInRange(event.date, query)
      && filterText(event.courseName, query.course)
      && (!query.status || query.status.toLowerCase() === "all"
        || (query.status.toLowerCase() === "submitted" ? latestSave === "Final submitted" : latestSave === "Draft saved"))
      && (!query.completion || query.completion.toLowerCase() === "all"
        || query.completion.toLowerCase() === completion?.toLowerCase()
        || (query.completion.toLowerCase() === "unmarked" && completion === "Unmarked rows")),
    )
    .sort((a, b) =>
      a.event.date.localeCompare(b.event.date)
      || a.event.courseName.localeCompare(b.event.courseName)
      || a.event.startTime.localeCompare(b.event.startTime),
    )
    .map(({ event, completion, latestSave }) => [
      event.courseName,
      event.date,
      `${event.day ?? "Session"} ${event.startTime}–${event.endTime}`,
      event.staffName ?? "Unassigned",
      latestSave,
      completion ?? "Not available",
      event.createdAt.toISOString(),
    ]);

  return {
    rows,
    asOf: latestTimestamp(events.map((event) => event.createdAt)),
  };
}

async function assessmentRows(reportId: ReportId, query: ReportQuery): Promise<ReportRow[]> {
  const records = await db.select({
    result: assessmentResultsTable.result,
    adjustedResult: assessmentResultsTable.adjustedResult,
    confirmed: assessmentResultsTable.confirmed,
    status: assessmentResultsTable.status,
    dateMarked: assessmentResultsTable.dateMarked,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
    courseName: coursesTable.name,
    academicYear: coursesTable.academicYear,
    unit: assessmentsTable.description,
    assessmentId: assessmentsTable.id,
  }).from(assessmentResultsTable)
    .innerJoin(assessmentsTable, eq(assessmentResultsTable.assessmentId, assessmentsTable.id))
    .innerJoin(studentsTable, eq(assessmentResultsTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(assessmentsTable.courseId, coursesTable.id));
  const filtered = records.filter((record) =>
    filterText(record.academicYear, query.academicYear)
    && filterText(record.courseName, query.course)
    && (!query.unit || record.unit.toLowerCase().includes(query.unit.toLowerCase())));
  if (reportId === "asmt-results") return filtered.map((record) => [
    `${record.surname}, ${record.forename}`, record.personCode, record.unit,
    record.adjustedResult ?? record.result ?? "Not graded", record.result ?? "—",
    record.confirmed ? "Yes" : "No", record.status.toLowerCase().includes("release") ? "Yes" : "No",
  ]);

  const groups = new Map<number, typeof filtered>();
  filtered.forEach((record) => groups.set(record.assessmentId, [...(groups.get(record.assessmentId) ?? []), record]));
  return [...groups.values()].map((group) => {
    const grade = (record: typeof group[number]) => (record.adjustedResult ?? record.result ?? "").toLowerCase();
    const count = (test: (value: string) => boolean) => group.filter((record) => test(grade(record))).length;
    return [
      group[0].courseName, group[0].unit,
      String(count((value) => value.includes("a*") || value.includes("dist*"))),
      String(count((value) => value.includes("distinction") || value === "a")),
      String(count((value) => value.includes("merit") || value === "b")),
      String(count((value) => value.includes("pass") || value === "c")),
      String(count((value) => value.includes("fail") || value === "u")),
      String(count((value) => !value)),
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

async function unconfirmedAssessmentData(query: ReportQuery): Promise<ReportData> {
  const records = await db.select({
    assessmentId: assessmentsTable.id,
    assessment: assessmentsTable.description,
    dueDate: assessmentsTable.dueDate,
    tutor: assessmentsTable.tutor,
    assessmentUpdatedAt: assessmentsTable.updatedAt,
    resultUpdatedAt: assessmentResultsTable.updatedAt,
    confirmed: assessmentResultsTable.confirmed,
    status: assessmentResultsTable.status,
    course: coursesTable.name,
  }).from(assessmentResultsTable)
    .innerJoin(assessmentsTable, eq(assessmentResultsTable.assessmentId, assessmentsTable.id))
    .innerJoin(coursesTable, eq(assessmentsTable.courseId, coursesTable.id));
  const filtered = records.filter((record) =>
    record.confirmed === 0
    && record.status.trim().toLowerCase() === "submitted"
    && filterText(record.course, query.course)
    && filterText(record.tutor, query.tutor));
  const groups = new Map<number, typeof filtered>();
  filtered.forEach((record) => groups.set(record.assessmentId, [...(groups.get(record.assessmentId) ?? []), record]));
  return {
    rows: [...groups.values()].map((group) => [
      group[0].assessment,
      group[0].course,
      displayDate(group[0].dueDate),
      String(group.length),
      group[0].tutor ?? "Unassigned",
    ]).sort((a, b) => a[0].localeCompare(b[0])),
    asOf: latestTimestamp(filtered.flatMap((record) => [record.assessmentUpdatedAt, record.resultUpdatedAt])),
  };
}

type IlpSectionRecord = {
  sections: Array<{ name: string; status: "completed" | "partial" | "not_started" }>;
};

export function latestIlpPerStudent<T extends { studentId: number; updatedAt: Date }>(records: T[]): T[] {
  const latest = new Map<number, T>();
  for (const record of records) {
    const existing = latest.get(record.studentId);
    if (!existing || record.updatedAt > existing.updatedAt) latest.set(record.studentId, record);
  }
  return [...latest.values()];
}

export function buildIlpSectionRows(records: IlpSectionRecord[]): ReportRow[] {
  const sectionNames = new Set<string>();
  for (const record of records) {
    for (const section of record.sections) {
      const name = section.name.trim();
      if (name) sectionNames.add(name);
    }
  }
  return [...sectionNames].map((name) => {
    const statuses = records.map((record) =>
      record.sections.find((section) => section.name.trim() === name)?.status ?? "not_started"
    );
    const completed = statuses.filter((status) => status === "completed").length;
    const partial = statuses.filter((status) => status === "partial").length;
    const notStarted = statuses.filter((status) => status === "not_started").length;
    return [name, String(statuses.length), String(completed), String(partial), String(notStarted), percentage(completed, statuses.length)];
  }).sort((a, b) => a[0].localeCompare(b[0]));
}

async function ilpData(reportId: "ilp-progress" | "ilp-reviews-due" | "ilp-completion", query: ReportQuery): Promise<ReportData> {
  const records = await db.select({
    studentId: ilpsTable.studentId,
    status: ilpsTable.status,
    tutor: ilpsTable.tutor,
    academicYear: ilpsTable.academicYear,
    lastReviewDate: ilpsTable.lastReviewDate,
    nextReviewDue: ilpsTable.nextReviewDue,
    sections: ilpsTable.sections,
    updatedAt: ilpsTable.updatedAt,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
  }).from(ilpsTable)
    .innerJoin(studentsTable, eq(ilpsTable.studentId, studentsTable.id));
  const filtered = records.filter((record) =>
    filterText(record.academicYear, query.academicYear)
    && filterText(record.tutor, query.tutor));
  const currentRecords = latestIlpPerStudent(filtered);

  if (reportId === "ilp-completion") {
    return {
      rows: buildIlpSectionRows(currentRecords),
      asOf: latestTimestamp(currentRecords.map((record) => record.updatedAt)),
    };
  }

  if (reportId === "ilp-reviews-due") {
    const today = new Date().toISOString().slice(0, 10);
    const dueThrough = query.overdueTo?.toISOString().slice(0, 10) ?? today;
    const due = currentRecords.filter((record) => record.nextReviewDue && record.nextReviewDue <= dueThrough);
    return {
      rows: due.map((record) => [
        `${record.surname}, ${record.forename}`,
        record.personCode,
        record.tutor ?? "Unassigned",
        displayDate(record.nextReviewDue),
        String(daysOverdue(record.nextReviewDue!, today)),
      ]).sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0])),
      asOf: latestTimestamp(due.map((record) => record.updatedAt)),
    };
  }

  const targetRecords = await db.select({
    studentId: targetsTable.studentId,
    updatedAt: targetsTable.updatedAt,
  }).from(targetsTable);
  const targetCounts = new Map<number, number>();
  targetRecords.forEach((target) => targetCounts.set(target.studentId, (targetCounts.get(target.studentId) ?? 0) + 1));
  const studentIds = new Set(currentRecords.map((record) => record.studentId));
  return {
    rows: currentRecords.map((record) => [
      `${record.surname}, ${record.forename}`,
      record.personCode,
      record.tutor ?? "Unassigned",
      titleCase(record.status),
      displayDate(record.lastReviewDate),
      displayDate(record.nextReviewDue),
      String(targetCounts.get(record.studentId) ?? 0),
    ]).sort((a, b) => a[0].localeCompare(b[0])),
    asOf: latestTimestamp([
      ...currentRecords.map((record) => record.updatedAt),
      ...targetRecords.filter((target) => studentIds.has(target.studentId)).map((target) => target.updatedAt),
    ]),
  };
}

async function atRiskData(query: ReportQuery): Promise<ReportData> {
  const records = await db.select({
    studentId: studentsTable.id,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
    courseId: coursesTable.id,
    course: coursesTable.name,
    status: attendanceTable.status,
    minutesLate: attendanceTable.minutesLate,
    updatedAt: attendanceTable.updatedAt,
  }).from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(attendanceTable.courseId, coursesTable.id));
  const filtered = records.filter((record) => filterText(record.course, query.course));
  const groups = new Map<string, typeof filtered>();
  filtered.forEach((record) => {
    const key = `${record.studentId}:${record.courseId}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  const threshold = Number(query.threshold?.replace("%", "") ?? 80);
  const atRiskGroups = [...groups.values()].filter((group) => {
    const attended = group.filter((record) => record.status === "present" || record.status === "late").length;
    return group.length > 0 && (attended / group.length) * 100 < threshold;
  });
  const today = new Date().toISOString().slice(0, 10);
  const overdueTargets = await db.select({
    studentId: targetsTable.studentId,
    dueDate: targetsTable.dueDate,
    completed: targetsTable.completed,
    updatedAt: targetsTable.updatedAt,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
  }).from(targetsTable)
    .innerJoin(studentsTable, eq(targetsTable.studentId, studentsTable.id));
  const progressRisk = overdueTargets.filter((target) => isProgressRisk(target, today));
  const progressRiskByStudent = new Map(progressRisk.map((target) => [target.studentId, target]));
  const attendanceRiskStudentIds = new Set(atRiskGroups.map((group) => group[0].studentId));
  const progressOnly = query.course
    ? []
    : progressRisk.filter((target) => !attendanceRiskStudentIds.has(target.studentId));
  const studentIds = new Set([
    ...attendanceRiskStudentIds,
    ...progressOnly.map((target) => target.studentId),
  ]);
  const contacts = await db.select({
    studentId: safeguardingNotesTable.studentId,
    lastContactedAt: safeguardingNotesTable.lastContactedAt,
    updatedAt: safeguardingNotesTable.updatedAt,
  }).from(safeguardingNotesTable);
  const lastContactByStudent = new Map<number, Date>();
  for (const contact of contacts) {
    if (!contact.lastContactedAt) continue;
    const existing = lastContactByStudent.get(contact.studentId);
    if (!existing || contact.lastContactedAt > existing) lastContactByStudent.set(contact.studentId, contact.lastContactedAt);
  }
  return {
    rows: [
      ...atRiskGroups.map((group) => {
      const attended = group.filter((record) => record.status === "present" || record.status === "late").length;
      const late = group.filter((record) => record.status === "late" || (record.minutesLate ?? 0) > 0).length;
      const hasProgressRisk = progressRiskByStudent.has(group[0].studentId);
      return [
        `${group[0].surname}, ${group[0].forename}`,
        group[0].personCode,
        group[0].course,
        percentage(attended, group.length),
        ["Attendance", ...(late > 0 ? ["Lateness"] : []), ...(hasProgressRisk ? ["Progress"] : [])].join(", "),
        displayDate(lastContactByStudent.get(group[0].studentId)),
      ];
      }),
      ...progressOnly.map((target) => [
        `${target.surname}, ${target.forename}`,
        target.personCode,
        "All courses",
        "No attendance records",
        "Progress",
        displayDate(lastContactByStudent.get(target.studentId)),
      ]),
    ].sort((a, b) => a[0].localeCompare(b[0])),
    asOf: latestTimestamp([
      ...atRiskGroups.flatMap((group) => group.map((record) => record.updatedAt)),
      ...progressRisk.filter((target) => studentIds.has(target.studentId)).map((target) => target.updatedAt),
      ...contacts.filter((contact) => studentIds.has(contact.studentId)).map((contact) => contact.updatedAt),
    ]),
  };
}

async function releasedGradesData(query: ReportQuery): Promise<ReportData> {
  const records = await db.select({
    result: assessmentResultsTable.result,
    adjustedResult: assessmentResultsTable.adjustedResult,
    gradeReleasedAt: assessmentResultsTable.gradeReleasedAt,
    updatedAt: assessmentResultsTable.updatedAt,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
    unit: assessmentsTable.description,
    course: coursesTable.name,
  }).from(assessmentResultsTable)
    .innerJoin(assessmentsTable, eq(assessmentResultsTable.assessmentId, assessmentsTable.id))
    .innerJoin(studentsTable, eq(assessmentResultsTable.studentId, studentsTable.id))
    .innerJoin(coursesTable, eq(assessmentsTable.courseId, coursesTable.id));
  const filtered = records.filter((record) =>
    record.gradeReleasedAt
    && filterText(record.course, query.course)
    && (!query.dateFrom || record.gradeReleasedAt >= query.dateFrom)
    && (!query.dateTo || record.gradeReleasedAt < new Date(query.dateTo.getTime() + 86_400_000)));
  return {
    rows: filtered.map((record) => [
      `${record.surname}, ${record.forename}`,
      record.personCode,
      record.unit,
      record.adjustedResult ?? record.result ?? "Not graded",
      displayDate(record.gradeReleasedAt),
    ]).sort((a, b) => b[4].localeCompare(a[4]) || a[0].localeCompare(b[0])),
    asOf: latestTimestamp(filtered.map((record) => record.updatedAt)),
  };
}

async function markbookRows(query: ReportQuery): Promise<ReportRow[]> {
  const records = await db.select({
    result: assessmentResultsTable.result,
    adjustedResult: assessmentResultsTable.adjustedResult,
    confirmed: assessmentResultsTable.confirmed,
    status: assessmentResultsTable.status,
    courseName: coursesTable.name,
    academicYear: coursesTable.academicYear,
    unit: assessmentsTable.description,
    assessmentId: assessmentsTable.id,
    courseId: coursesTable.id,
  }).from(assessmentResultsTable)
    .innerJoin(assessmentsTable, eq(assessmentResultsTable.assessmentId, assessmentsTable.id))
    .innerJoin(coursesTable, eq(assessmentsTable.courseId, coursesTable.id))
    .where(and(
      query.academicYear ? eq(coursesTable.academicYear, query.academicYear) : undefined,
      query.course && query.course !== "All courses" ? ilike(coursesTable.name, `%${query.course}%`) : undefined,
    ));
  const enrollments = await db.select({ courseId: enrollmentsTable.courseId, studentId: enrollmentsTable.studentId })
    .from(enrollmentsTable);
  const groups = new Map<number, typeof records>();
  records.forEach((record) => groups.set(record.assessmentId, [...(groups.get(record.assessmentId) ?? []), record]));
  return [...groups.values()].map((group) => {
    const graded = group.filter((record) => Boolean(record.adjustedResult ?? record.result) && !record.status.toLowerCase().includes("not marked")).length;
    const verified = group.filter((record) => record.confirmed > 0).length;
    const released = group.filter((record) => record.status.toLowerCase().includes("release")).length;
    const total = new Set(enrollments.filter((enrollment) => enrollment.courseId === group[0].courseId).map((enrollment) => enrollment.studentId)).size;
    return [
      group[0].courseName, group[0].unit, String(total), String(graded), String(verified), String(released),
      percentage(verified, total),
    ];
  }).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

async function plannedAbsenceRows(query: ReportQuery): Promise<ReportRow[]> {
  const records = await db.select({
    fromDate: plannedAbsencesTable.fromDate,
    toDate: plannedAbsencesTable.toDate,
    reason: plannedAbsencesTable.reason,
    status: plannedAbsencesTable.status,
    forename: studentsTable.forename,
    surname: studentsTable.surname,
    personCode: studentsTable.personCode,
  }).from(plannedAbsencesTable).innerJoin(studentsTable, eq(plannedAbsencesTable.studentId, studentsTable.id));
  const requestedStatus = query.status?.toLowerCase() === "awaiting decision"
    ? "pending"
    : query.status?.toLowerCase();
  return records.filter((record) =>
    (!query.dateFrom || record.toDate >= query.dateFrom.toISOString().slice(0, 10))
    && (!query.dateTo || record.fromDate <= query.dateTo.toISOString().slice(0, 10))
    && (!requestedStatus || requestedStatus === "all" || record.status.toLowerCase() === requestedStatus)
  ).map((record) => [
    `${record.surname}, ${record.forename}`, record.personCode, record.reason,
    record.fromDate, record.toDate, record.status === "pending" ? "Awaiting Decision" : record.status,
  ]);
}

router.get("/reports/:reportId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required to run reports" });
  if (!canAccessReports(req.user)) return res.status(403).json({ error: "Reports access denied for this role" });

  const parsedId = GetReportParams.safeParse({ reportId: req.params.reportId });
  if (!parsedId.success) return res.status(400).json({ error: "Unknown report identifier" });
  const reportId = parsedId.data.reportId;
  if (reportId === "sg-at-risk" && !canAccessSafeguarding(req.user)) {
    return res.status(403).json({ error: "Safeguarding access required for this report" });
  }
  const parsedQuery = parseQuery(req, reportId);
  if (parsedQuery.error) return res.status(400).json({ error: parsedQuery.error });

  const query = parsedQuery.data!;
  const generatedAt = new Date();
  let rows: ReportRow[];
  let asOf: Date | null = null;
  if (reportId === "att-register-progress") ({ rows, asOf } = await registerProgressData(query));
  else if (reportId.startsWith("att-")) rows = await attendanceRows(reportId, query);
  else if (reportId === "asmt-unconfirmed") ({ rows, asOf } = await unconfirmedAssessmentData(query));
  else if (reportId.startsWith("asmt-")) rows = await assessmentRows(reportId, query);
  else if (reportId === "ilp-progress" || reportId === "ilp-reviews-due" || reportId === "ilp-completion") {
    ({ rows, asOf } = await ilpData(reportId, query));
  }
  else if (reportId === "sg-at-risk") ({ rows, asOf } = await atRiskData(query));
  else if (reportId === "sg-planned-absence") rows = await plannedAbsenceRows(query);
  else if (reportId === "mb-grades-released") ({ rows, asOf } = await releasedGradesData(query));
  else rows = await markbookRows(query);

  const meta = REPORT_META[reportId];
  const response = {
    reportId,
    title: meta.title,
    description: meta.description,
    columns: meta.columns,
    rows,
    appliedFilters: filterLabel(query),
    rowCount: rows.length,
    generatedAt: generatedAt.toISOString(),
    asOf: asOf?.toISOString() ?? null,
  };
  return res.json(response);
});

export default router;