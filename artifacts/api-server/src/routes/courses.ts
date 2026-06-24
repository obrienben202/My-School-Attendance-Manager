import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateCourseBody,
  GetCourseParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/courses", async (_req, res) => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.name);
  return res.json(courses.map(toCourseResponse));
});

router.post("/courses", async (req, res) => {
  const parsed = CreateCourseBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [course] = await db.insert(coursesTable).values(parsed.data).returning();
  return res.status(201).json(toCourseResponse(course));
});

router.get("/courses/:id", async (req, res) => {
  const parsed = GetCourseParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parsed.data.id));
  if (!course) return res.status(404).json({ error: "Not found" });
  return res.json(toCourseResponse(course));
});

function toCourseResponse(c: typeof coursesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
