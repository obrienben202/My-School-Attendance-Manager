import { Router, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  attendanceTable,
  coursesTable,
  db,
  scheduleTable,
  staffTimetableTable,
  usersTable,
} from "@workspace/db";
import { normaliseStaffName, staffNameKey, staffNamesMatch } from "../lib/staff-identity";
import { isStaffAssignedToSchedule } from "../lib/attendance-authorization";

const router = Router();

type StaffSource = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  staffCode: string | null;
  personCode: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  position: string | null;
  role: string | null;
};

type CourseSource = typeof coursesTable.$inferSelect;

function userDisplayName(user: typeof usersTable.$inferSelect): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || "";
}

function matchesStaff(courseStaffName: string | null | undefined, staffName: string): boolean {
  return staffNamesMatch(courseStaffName, staffName);
}

function requireAuthenticated(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

async function loadStaffSources() {
  const [users, courses] = await Promise.all([
    db.select().from(usersTable).orderBy(usersTable.firstName, usersTable.lastName),
    db.select().from(coursesTable).where(eq(coursesTable.isActive, true)).orderBy(coursesTable.name),
  ]);

  const sources: StaffSource[] = users
    .filter(user => userDisplayName(user))
    .map(user => ({
      id: user.id,
      fullName: userDisplayName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      staffCode: null,
      personCode: null,
      title: null,
      email: user.email,
      phone: null,
      organisation: user.department,
      position: null,
      role: user.role,
    }));

  const knownNames = new Set(sources.map(source => normaliseStaffName(source.fullName)));
  for (const course of courses) {
    if (!course.staffName || knownNames.has(normaliseStaffName(course.staffName))) continue;
    knownNames.add(normaliseStaffName(course.staffName));
    sources.push({
      id: staffNameKey(course.staffName),
      fullName: course.staffName,
      firstName: null,
      lastName: null,
      staffCode: null,
      personCode: null,
      title: null,
      email: null,
      phone: null,
      organisation: null,
      position: null,
      role: null,
    });
  }

  return { sources, courses };
}

async function loadStaffRecord(id: string) {
  const { sources, courses } = await loadStaffSources();
  const source = sources.find(candidate => candidate.id === id);
  if (!source) return null;

  const assignedCourses = courses.filter(course => matchesStaff(course.staffName, source.fullName));
  return { source, courses, assignedCourses };
}

function staffResponse(source: StaffSource, assignedCourses: CourseSource[]) {
  return {
    ...source,
    courses: assignedCourses.map(course => ({
      id: course.id,
      code: course.code,
      name: course.name,
      room: course.room,
      staffName: course.staffName,
      yearGroup: course.yearGroup,
      enrolledCount: course.enrolledCount,
      isActive: course.isActive,
    })),
  };
}

async function scopedSchedule(source: StaffSource) {
  const rows = await db
    .select({
      id: scheduleTable.id,
      courseId: coursesTable.id,
      courseCode: coursesTable.code,
      courseName: coursesTable.name,
      courseStaffName: coursesTable.staffName,
      scheduleStaffName: scheduleTable.staffName,
      day: scheduleTable.day,
      startTime: scheduleTable.startTime,
      endTime: scheduleTable.endTime,
      room: scheduleTable.room,
      weekPattern: scheduleTable.weekPattern,
      registerMarked: scheduleTable.registerMarked,
    })
    .from(scheduleTable)
    .innerJoin(coursesTable, eq(scheduleTable.courseId, coursesTable.id))
    .where(eq(coursesTable.isActive, true))
    .orderBy(scheduleTable.day, scheduleTable.startTime);

  return rows.filter(row => isStaffAssignedToSchedule(source.fullName, row));
}

async function scopedStaffTimetable(source: StaffSource) {
  const rows = await db
    .select()
    .from(staffTimetableTable)
    .orderBy(staffTimetableTable.day, staffTimetableTable.lessonNumber);

  return rows.filter(row => row.staffName && matchesStaff(row.staffName, source.fullName));
}

router.get("/staff", async (_req, res) => {
  if (!requireAuthenticated(_req, res)) return;
  const { sources } = await loadStaffSources();
  return res.json(sources);
});

router.get("/staff/:id", async (req, res) => {
  if (!requireAuthenticated(req, res)) return;
  const record = await loadStaffRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Staff member not found" });
  return res.json(staffResponse(record.source, record.assignedCourses));
});

router.get("/staff/:id/timetable", async (req, res) => {
  if (!requireAuthenticated(req, res)) return;
  const record = await loadStaffRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Staff member not found" });

  const [courseRows, personalRows] = await Promise.all([
    scopedSchedule(record.source),
    scopedStaffTimetable(record.source),
  ]);
  const timetable = [
    ...courseRows.map(row => ({
      id: `course-${row.id}`,
      source: "course" as const,
      courseId: row.courseId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room,
      weekPattern: row.weekPattern,
      description: row.courseName,
      groupLabel: null,
      registerMarked: row.registerMarked,
    })),
    ...personalRows.map(row => ({
      id: `staff-${row.id}`,
      source: "staff" as const,
      courseId: null,
      courseCode: null,
      courseName: null,
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room,
      weekPattern: null,
      description: row.description,
      groupLabel: row.groupLabel,
      registerMarked: null,
    })),
  ];

  return res.json({
    staffId: record.source.id,
    staffName: record.source.fullName,
    records: timetable,
  });
});

router.get("/staff/:id/register-history", async (req, res) => {
  if (!requireAuthenticated(req, res)) return;
  const record = await loadStaffRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Staff member not found" });

  const scheduleRows = await scopedSchedule(record.source);
  const coursesById = new Map(
    record.assignedCourses.map(course => [course.id, {
      id: course.id,
      code: course.code,
      name: course.name,
      room: course.room,
    }]),
  );
  for (const row of scheduleRows) {
    coursesById.set(row.courseId, {
      id: row.courseId,
      code: row.courseCode,
      name: row.courseName,
      room: row.room,
    });
  }
  const courseIds = [...coursesById.keys()];
  const attendanceRows = courseIds.length
    ? await db.select().from(attendanceTable).where(inArray(attendanceTable.courseId, courseIds))
    : [];

  const schedulesById = new Map(scheduleRows.map(row => [row.id, row]));
  const linkedSessions = new Map<string, {
    schedule: (typeof scheduleRows)[number];
    date: string;
    attendance: typeof attendanceRows;
  }>();
  for (const row of attendanceRows) {
    if (row.scheduleId === null) continue;
    const schedule = schedulesById.get(row.scheduleId);
    if (!schedule) continue;
    const key = `${row.scheduleId}:${row.date}`;
    const current = linkedSessions.get(key) ?? { schedule, date: row.date, attendance: [] };
    current.attendance.push(row);
    linkedSessions.set(key, current);
  }

  const attendanceByCourse = new Map<number, typeof attendanceRows>();
  for (const row of attendanceRows.filter(item => item.scheduleId === null)) {
    const current = attendanceByCourse.get(row.courseId) ?? [];
    current.push(row);
    attendanceByCourse.set(row.courseId, current);
  }

  return res.json({
    staffId: record.source.id,
    staffName: record.source.fullName,
    sessions: [...linkedSessions.values()]
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        b.schedule.startTime.localeCompare(a.schedule.startTime),
      )
      .map(({ schedule, date, attendance }) => ({
        id: `schedule-${schedule.id}-${date}`,
        scope: "exact-session" as const,
        scheduleId: schedule.id,
        sessionDate: date,
        courseId: schedule.courseId,
        courseCode: schedule.courseCode,
        courseName: schedule.courseName,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        weekPattern: schedule.weekPattern,
        attendanceRecords: attendance.length,
        present: attendance.filter(item => item.status === "present").length,
        absent: attendance.filter(item => item.status === "absent").length,
        late: attendance.filter(item => item.status === "late").length,
        authorised: attendance.filter(item => item.status === "authorised").length,
      })),
    records: [...coursesById.values()].map(course => {
      const attendance = attendanceByCourse.get(course.id) ?? [];
      const schedules = scheduleRows.filter(row => row.courseId === course.id);
      return {
        id: course.id,
        scope: "legacy-course-level" as const,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        room: course.room,
        scheduleCount: schedules.length,
        markedScheduleCount: schedules.filter(row => row.registerMarked).length,
        attendanceRecords: attendance.length,
        present: attendance.filter(item => item.status === "present").length,
        absent: attendance.filter(item => item.status === "absent").length,
        late: attendance.filter(item => item.status === "late").length,
        authorised: attendance.filter(item => item.status === "authorised").length,
        lastAttendanceDate: attendance.length
          ? attendance.reduce((latest, item) => item.date > latest ? item.date : latest, attendance[0].date)
          : null,
      };
    }),
  });
});

router.get("/staff/:id/room-bookings", async (req, res) => {
  if (!requireAuthenticated(req, res)) return;
  const record = await loadStaffRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Staff member not found" });
  return res.json({
    staffId: record.source.id,
    staffName: record.source.fullName,
    sourceAvailable: false,
    records: [],
    message: "Room booking records are not available in the connected data source.",
  });
});

router.get("/staff/:id/correspondence", async (req, res) => {
  if (!requireAuthenticated(req, res)) return;
  const record = await loadStaffRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Staff member not found" });
  return res.json({
    staffId: record.source.id,
    staffName: record.source.fullName,
    sourceAvailable: false,
    records: [],
    message: "Staff correspondence is not available in the connected data source.",
  });
});

export default router;