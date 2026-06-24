import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const ilpsTable = pgTable("ilps", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  status: text("status").notNull().default("active"), // draft, active, completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIlpSchema = createInsertSchema(ilpsTable).omit({ id: true, createdAt: true });
export type InsertIlp = z.infer<typeof insertIlpSchema>;
export type Ilp = typeof ilpsTable.$inferSelect;
