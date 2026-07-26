import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Stores attendance/punctuality KPI thresholds from the KPI sheet
export const kpiBenchmarksTable = pgTable("kpi_benchmarks", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // "attendance" | "punctuality"
  label: text("label").notNull(),       // "Exceptional" | "Good" | "Satisfactory" | "Unsatisfactory"
  lowerPercent: numeric("lower_percent", { precision: 5, scale: 2 }).notNull(),
  upperPercent: numeric("upper_percent", { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKpiBenchmarkSchema = createInsertSchema(kpiBenchmarksTable).omit({ id: true, updatedAt: true });
export type InsertKpiBenchmark = z.infer<typeof insertKpiBenchmarkSchema>;
export type KpiBenchmark = typeof kpiBenchmarksTable.$inferSelect;
