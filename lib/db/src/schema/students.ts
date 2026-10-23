import { pgTable, serial, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  personCode: text("person_code").notNull().unique(),
  forename: text("forename").notNull(),
  surname: text("surname").notNull(),
  middleNames: text("middle_names"),
  title: text("title"),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  postCode: text("post_code"),
  yearGroup: text("year_group"),
  formGroup: text("form_group"),
  attendancePercent: numeric("attendance_percent", { precision: 5, scale: 2 }).notNull().default("100"),
  punctualityPercent: numeric("punctuality_percent", { precision: 5, scale: 2 }).notNull().default("100"),
  atRisk: boolean("at_risk").notNull().default(false),
  confirmedLearner: boolean("confirmed_learner").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
