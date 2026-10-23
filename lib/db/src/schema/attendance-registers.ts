import { pgTable, serial, integer, text, date, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scheduleTable } from "./schedule";

export const attendanceRegistersTable = pgTable(
  "attendance_registers",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id").notNull().references(() => scheduleTable.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("open"),
    updatedBy: text("updated_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("attendance_register_schedule_date_unique").on(table.scheduleId, table.date),
  ],
);

export const attendanceRegisterAuditTable = pgTable(
  "attendance_register_audit",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id").notNull().references(() => scheduleTable.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    action: text("action").notNull(),
    userId: text("user_id").notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("attendance_register_audit_occurrence_idx").on(table.scheduleId, table.date, table.createdAt),
  ],
);

export const insertAttendanceRegisterSchema = createInsertSchema(attendanceRegistersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAttendanceRegisterAuditSchema = createInsertSchema(attendanceRegisterAuditTable).omit({
  id: true,
  createdAt: true,
});

export type AttendanceRegister = typeof attendanceRegistersTable.$inferSelect;
export type AttendanceRegisterAudit = typeof attendanceRegisterAuditTable.$inferSelect;
export type InsertAttendanceRegister = z.infer<typeof insertAttendanceRegisterSchema>;
export type InsertAttendanceRegisterAudit = z.infer<typeof insertAttendanceRegisterAuditSchema>;