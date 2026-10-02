import { check, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./auth";

export type IlpGroupFilter = { field: "Year Group"; operator: "equals" | "is not"; value: string };
export const ilpGroupsTable = pgTable("ilp_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<IlpGroupFilter[]>().notNull(),
  defaultYear: integer("default_year"),
  createdById: varchar("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("ilp_groups_default_year").on(t.defaultYear),
  check("ilp_groups_default_year_range", sql`${t.defaultYear} IS NULL OR ${t.defaultYear} BETWEEN 7 AND 11`),
]);
export const insertIlpGroupSchema = createInsertSchema(ilpGroupsTable).omit({ id: true, createdAt: true });
export type IlpGroup = typeof ilpGroupsTable.$inferSelect;
export type InsertIlpGroup = typeof ilpGroupsTable.$inferInsert;