import { Router, type Request, type Response } from "express";
import { and, eq, ilike } from "drizzle-orm";
import {
  attendanceTable,
  assessmentResultsTable,
  assessmentsTable,
  coursesTable,
  db,
  enrollmentsTable,
  plannedAbsencesTable,
  scheduleTable,
  studentsTable,
} from "@workspace/db";
import {
  GetReportParams,
} from "@workspace/api-zod";
import { canAccessReports } from "../lib/report-access";

const router = Router();

type ReportColumn = { key: string; label: string };
type ReportRow = string[];
type ReportId =
  | "att-overall" | "att-learner" | "att-course" | "att-punctuality"
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
};

const REPORT_META: Record<ReportId, {
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
    columns: [],
  },
  "ilp-progress": {
    title: "ILP Progress Summary",
    description: "Overview of ILP completion status across learners.",
    columns: [],
  },
  "ilp-reviews-due": {
    title: "ILP Reviews Due",
    description: "Learners whose ILP review is due or overdue.",
    columns: [],
  },
  "ilp-completion": {
    title: "ILP Section Completion",
    description: "Completion rates for each ILP section.",
    columns: [],
  },
  "sg-at-risk": {
    title: "At-Risk Learners",
    description: "Learners flagged as at-risk based on attendance and progress.",
    columns: [],
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
    columns: [],
  },
};

const unsupportedReports = new Set<ReportId>([
  "asmt-unconfirmed", "ilp-progress", "ilp-reviews-due", "ilp-completion",
  "sg-at-risk", "mb-grades-released",
]);

const FILTERS_BY_REPORT: Record<ReportId, Set<keyof ReportQuery>> = {
  "att-overall": new Set(["academicYear", "dateFrom", "dateTo", "course"]),
  "att-learner": new Set(["academicYear", "surname", "course", "dateFrom", "dateTo"]),
  "att-course": new Set(["course", "dateFrom", "dateTo"]),
  "att-punctuality": new Set(["academicYear", "threshold"]),
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
  if (raw.status && !["all", "awaiting decision", "approved", "declined"].includes(raw.status.toLowerCase())) {
    return { error: "Invalid planned absence status" };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.length > 200) return { error: `${key} is too long` };
  }
  return {
    data: {
      academicYear: raw.academicYear || undefined, dateFrom, dateTo, course: raw.course || undefined,
      surname: raw.surname || undefined, threshold: raw.threshold || undefined, tutor: raw.tutor || undefined,
      unit: raw.unit || undefined, overdueTo, status: raw.status || undefined,
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
  const parsedQuery = parseQuery(req, reportId);
  if (parsedQuery.error) return res.status(400).json({ error: parsedQuery.error });
  if (unsupportedReports.has(reportId)) {
    return res.status(422).json({ error: `${REPORT_META[reportId].title} is unavailable because the required fields are not persisted` });
  }

  const query = parsedQuery.data!;
  const generatedAt = new Date();
  let rows: ReportRow[];
  if (reportId.startsWith("att-")) rows = await attendanceRows(reportId, query);
  else if (reportId.startsWith("asmt-")) rows = await assessmentRows(reportId, query);
  else if (reportId === "mb-verification-status") rows = await markbookRows(query);
  else rows = await plannedAbsenceRows(query);

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
    // The joined source tables do not all maintain update timestamps, so a
    // truthful source-data watermark cannot currently be calculated.
    asOf: null,
  };
  return res.json(response);
});

export default router;