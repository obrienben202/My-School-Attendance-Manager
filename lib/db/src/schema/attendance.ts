import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { coursesTable } from "./courses";
import { scheduleTable } from "./schedule";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  // Null identifies legacy attendance that is only trustworthy at course/date level.
  scheduleId: integer("schedule_id").references(() => scheduleTable.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  status: text("status").notNull(), // present, absent, late, authorised
  notes: text("notes"),
  markedBy: text("marked_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
