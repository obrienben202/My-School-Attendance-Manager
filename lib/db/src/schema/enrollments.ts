import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { coursesTable } from "./courses";

export const enrollmentsTable = pgTable("student_enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  contactEmail: text("contact_email"),
  photoObjectPath: text("photo_object_path"),
  photoContentType: text("photo_content_type"),
  photoUpdatedAt: timestamp("photo_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.studentId, t.courseId)]);

export const insertEnrollmentSchema = createInsertSchema(enrollmentsTable).omit({ id: true, createdAt: true });
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollmentsTable.$inferSelect;

export const enrolmentPhotoUploadsTable = pgTable("enrolment_photo_uploads", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => enrollmentsTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull().unique(),
  requestedBy: text("requested_by").notNull(),
  expectedContentType: text("expected_content_type").notNull(),
  expectedSize: integer("expected_size").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnrolmentPhotoUploadSchema = createInsertSchema(enrolmentPhotoUploadsTable).omit({
  id: true,
  createdAt: true,
});
export type EnrolmentPhotoUpload = typeof enrolmentPhotoUploadsTable.$inferSelect;
