import { pgTable, serial, integer, text, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { coursesTable } from "./courses";
import { scheduleTable } from "./schedule";

export const attendanceTable = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
    courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
    // Null identifies legacy attendance that is only trustworthy at course/date level.
    scheduleId: integer("schedule_id").references(() => scheduleTable.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    status: text("status").notNull(),
    minutesLate: integer("minutes_late"),
    notes: text("notes"),
    markedBy: text("marked_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_student_schedule_date_unique").on(
      table.studentId,
      table.scheduleId,
      table.date,
    ),
  ],
);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
