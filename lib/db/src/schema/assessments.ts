import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assessmentsTable = pgTable("assessments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("Assignment"),
  dueDate: text("due_date"),
  gradingScheme: text("grading_scheme").notNull().default("Percentage"),
  minPassMark: text("min_pass_mark"),
  marksOutOf: integer("marks_out_of"),
  active: integer("active").notNull().default(1),
  order: integer("order").notNull().default(1),
  location: text("location"),
  organisation: text("organisation"),
  mandatory: integer("mandatory").notNull().default(0),
  allowAegrotats: integer("allow_aegrotats").notNull().default(0),
  tutor: text("tutor"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const assessmentResultsTable = pgTable("assessment_results", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull(),
  studentId: integer("student_id").notNull(),
  result: text("result"),
  adjustedResult: text("adjusted_result"),
  attempt: integer("attempt").notNull().default(1),
  reasonForZeroMark: text("reason_for_zero_mark"),
  mitigatingCircs: text("mitigating_circs"),
  dateSubmitted: text("date_submitted"),
  dateMarked: text("date_marked"),
  confirmed: integer("confirmed").notNull().default(0),
  status: text("status").notNull().default("Not Marked"),
  gradeReleasedAt: timestamp("grade_released_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;

export const insertAssessmentResultSchema = createInsertSchema(assessmentResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessmentResult = z.infer<typeof insertAssessmentResultSchema>;
export type AssessmentResult = typeof assessmentResultsTable.$inferSelect;
