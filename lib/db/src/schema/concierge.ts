import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conciergeApplicationsTable = pgTable("concierge_applications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id"),
  courseId: integer("course_id"),
  forename: text("forename"),
  surname: text("surname"),
  email: text("email"),
  status: text("status").notNull().default("Applied"),
  interviewDate: text("interview_date"),
  interviewNotes: text("interview_notes"),
  interviewStatus: text("interview_status").default("Scheduled"),
  offerType: text("offer_type"),
  offerStatus: text("offer_status"),
  progressNotes: text("progress_notes"),
  qualifications: text("qualifications"),
  requirements: text("requirements"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConciergeApplicationSchema = createInsertSchema(conciergeApplicationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertConciergeApplication = z.infer<typeof insertConciergeApplicationSchema>;
export type ConciergeApplication = typeof conciergeApplicationsTable.$inferSelect;
