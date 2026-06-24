import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const scheduleTable = pgTable("schedule", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room"),
  staffName: text("staff_name"),
  registerMarked: boolean("register_marked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(scheduleTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof scheduleTable.$inferSelect;
