import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eprogressionsTable = pgTable("eprogressions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("learner"),
  studentId: integer("student_id"),
  courseId: integer("course_id"),
  courseCode: text("course_code").notNull(),
  calOccCode: text("cal_occ_code"),
  currentProgressCode: text("current_progress_code"),
  newProgressCode: text("new_progress_code").notNull(),
  progressDate: text("progress_date").notNull(),
  comments: text("comments"),
  reason: text("reason"),
  status: text("status").notNull().default("Pending"),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEprogressionSchema = createInsertSchema(eprogressionsTable).omit({
  id: true,
  submittedAt: true,
});
export type InsertEprogression = z.infer<typeof insertEprogressionSchema>;
export type Eprogression = typeof eprogressionsTable.$inferSelect;
