import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  room: text("room"),
  staffName: text("staff_name"),
  yearGroup: text("year_group"),
  enrolledCount: integer("enrolled_count").notNull().default(0),
  headOfDepartment: text("head_of_department"),
  // Extended fields — synced from sheet or derived from course name
  level: text("level"),
  faculty: text("faculty"),
  academicYear: text("academic_year").default("2024/25"),
  courseHours: integer("course_hours").default(180),
  status: text("status").default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, createdAt: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
