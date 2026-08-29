import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { usersTable } from "./auth";

export const safeguardingNotesTable = pgTable("safeguarding_notes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
  authorUserId: varchar("author_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  content: text("content").notNull(),
  status: varchar("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSafeguardingNoteSchema = createInsertSchema(safeguardingNotesTable).omit({
  id: true,
  authorUserId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSafeguardingNote = z.infer<typeof insertSafeguardingNoteSchema>;
export type SafeguardingNote = typeof safeguardingNotesTable.$inferSelect;