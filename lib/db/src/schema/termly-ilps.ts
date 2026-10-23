import { date, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { usersTable } from "./auth";

export type ReviewTemplateContent = {
  title: string;
  welcome: string;
  instructions: string;
  endGuidance: string;
  targetExamples: { academic: string; personal: string; future: string };
  sections: { id: string; title: string; instructions: string; questions: { id: string; prompt: string; required: boolean }[] }[];
};
export type ReviewWork = {
  answers: Record<string, string>;
  summary: string;
  targets: { category: "academic" | "personal" | "future"; description: string; steps: string; progress: string; completed: boolean }[];
  priorTargetUpdates: Record<string, { progress: string; completed: boolean }>;
};
export type ReviewEvent = { action: string; actorId: string; at: string; comment?: string };

export const ilpTemplatesTable = pgTable("ilp_review_templates", {
  id: serial("id").primaryKey(),
  term: integer("term").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(0),
  content: jsonb("content").$type<ReviewTemplateContent>().notNull(),
  createdBy: varchar("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("ilp_template_term_version").on(t.term, t.version)]);

export const ilpTermsTable = pgTable("ilp_review_terms", {
  id: serial("id").primaryKey(),
  academicYear: text("academic_year").notNull(),
  term: integer("term").notNull(),
  templateId: integer("template_id").notNull().references(() => ilpTemplatesTable.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  deadline: date("deadline", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("ilp_term_year_term").on(t.academicYear, t.term)]);

export const ilpAssignmentsTable = pgTable("ilp_learner_assignments", {
  studentId: integer("student_id").primaryKey().references(() => studentsTable.id, { onDelete: "cascade" }),
  learnerUserId: varchar("learner_user_id").unique().references(() => usersTable.id, { onDelete: "set null" }),
  tutorUserId: varchar("tutor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy: varchar("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ilpReviewsTable = pgTable("ilp_term_reviews", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  termId: integer("term_id").notNull().references(() => ilpTermsTable.id),
  templateId: integer("template_id").notNull().references(() => ilpTemplatesTable.id),
  status: text("status").notNull().default("not_started"),
  revision: integer("revision").notNull().default(0),
  work: jsonb("work").$type<ReviewWork>().notNull().default({ answers: {}, summary: "", targets: [], priorTargetUpdates: {} }),
  teacherComment: text("teacher_comment").notNull().default(""),
  reviewDate: date("review_date", { mode: "string" }),
  history: jsonb("history").$type<ReviewEvent[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("ilp_review_student_term").on(t.studentId, t.termId)]);

export const ilpSupportAuditTable = pgTable("ilp_support_audit", {
  id: serial("id").primaryKey(),
  actorId: varchar("actor_id").notNull(),
  reviewId: integer("review_id"),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});