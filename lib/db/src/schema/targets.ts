import { pgTable, serial, integer, text, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const targetsTable = pgTable("targets", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTargetSchema = createInsertSchema(targetsTable).omit({ id: true, createdAt: true });
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type Target = typeof targetsTable.$inferSelect;
