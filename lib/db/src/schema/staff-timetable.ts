import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const staffTimetableTable = pgTable("staff_timetable_slots", {
  id:           serial("id").primaryKey(),
  staffName:    text("staff_name"),                               // NULL = shared across all HoD staff
  day:          text("day").notNull(),
  lessonNumber: integer("lesson_number").notNull(),
  startTime:    text("start_time").notNull(),
  endTime:      text("end_time").notNull(),
  description:  text("description").notNull(),
  groupLabel:   text("group_label"),
  room:         text("room"),
  isHodShared:  boolean("is_hod_shared").notNull().default(false),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export type StaffTimetableSlot = typeof staffTimetableTable.$inferSelect;
