import { boolean, date, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { usersTable } from "./auth";

export const plannedAbsencesTable = pgTable("planned_absences", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
  submittedByUserId: varchar("submitted_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromDate: date("from_date", { mode: "string" }).notNull(),
  toDate: date("to_date", { mode: "string" }).notNull(),
  reason: text("reason").notNull(),
  partDay: boolean("part_day").notNull().default(false),
  startTime: text("start_time"),
  endTime: text("end_time"),
  notes: text("notes"),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlannedAbsenceSchema = createInsertSchema(plannedAbsencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlannedAbsence = z.infer<typeof insertPlannedAbsenceSchema>;
export type PlannedAbsence = typeof plannedAbsencesTable.$inferSelect;