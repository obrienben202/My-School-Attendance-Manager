import { date, jsonb, pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export type IlpSectionState = {
  name: string;
  status: "completed" | "partial" | "not_started";
};

export const ilpsTable = pgTable("ilps", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  status: text("status").notNull().default("active"), // draft, active, completed
  tutor: text("tutor"),
  academicYear: text("academic_year"),
  lastReviewDate: date("last_review_date"),
  nextReviewDue: date("next_review_due"),
  sections: jsonb("sections").$type<IlpSectionState[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIlpSchema = createInsertSchema(ilpsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIlp = z.infer<typeof insertIlpSchema>;
export type Ilp = typeof ilpsTable.$inferSelect;
