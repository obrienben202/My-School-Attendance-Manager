import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, ilpGroupsTable as groups, studentsTable, type IlpGroup } from "@workspace/db";
import {
  ListIlpGroupsResponse, ListIlpGroupsResponseItem, CreateIlpGroupBody,
  UpdateIlpGroupBody, UpdateIlpGroupParams, UpdateIlpGroupResponse, DeleteIlpGroupParams,
} from "@workspace/api-zod";
import { SCHOOL_STAFF_ROLES } from "../lib/termly-staff-comments";
import { groupMatchesYear } from "../lib/ilp-group-rules";

const router = Router();
router.use("/termly-ilps/groups", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Authentication required" }); return; }
  if (!SCHOOL_STAFF_ROLES.includes(req.user.role)) { res.status(403).json({ error: "School staff access required" }); return; }
  if (req.method !== "GET" && req.user.role !== "admin") { res.status(403).json({ error: "Administrator access required" }); return; }
  next();
});

async function output(group: IlpGroup) {
  const roster = await db.select({ yearGroup: studentsTable.yearGroup }).from(studentsTable).where(eq(studentsTable.confirmedLearner, true));
  return serialize(group, roster);
}
function serialize(group: IlpGroup, roster: { yearGroup: string | null }[]) {
  return {
    id: group.id, name: group.name, filters: group.filters, defaultYear: group.defaultYear,
    createdBy: group.createdBy, createdAt: group.createdAt.toISOString(),
    learnerCount: roster.filter(s => groupMatchesYear(group.filters, s.yearGroup)).length,
  };
}
const inputError = "Invalid group: use a non-blank name (up to 120 characters) and only Year Group filters, equals or is not, with Year 7–11. Course, Attendance %, Status, Faculty and Gender are not supported.";

router.get("/termly-ilps/groups", async (_req, res): Promise<void> => {
  // Unique default keys make initialization safe across simultaneous sessions.
  // Never update existing rows; renamed/edited defaults remain unchanged.
  await db.insert(groups).values([7, 8, 9, 10, 11].map(year => ({
    name: `Year ${year}`, defaultYear: year, createdBy: "System default",
    filters: [{ field: "Year Group" as const, operator: "equals" as const, value: `Year ${year}` }],
  }))).onConflictDoNothing();
  const saved = await db.select().from(groups).orderBy(groups.id);
  const roster = await db.select({ yearGroup: studentsTable.yearGroup }).from(studentsTable).where(eq(studentsTable.confirmedLearner, true));
  res.json(ListIlpGroupsResponse.parse(saved.map(g => serialize(g, roster))));
});

router.post("/termly-ilps/groups", async (req, res): Promise<void> => {
  const parsed = CreateIlpGroupBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) { res.status(400).json({ error: inputError }); return; }
  const actor = req.user!;
  const [saved] = await db.insert(groups).values({
    ...parsed.data, name: parsed.data.name.trim(), createdById: actor.id,
    createdBy: [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() || actor.username || actor.id,
  }).returning();
  res.status(201).json(ListIlpGroupsResponseItem.parse(await output(saved)));
});

router.put("/termly-ilps/groups/:id", async (req, res): Promise<void> => {
  const params = UpdateIlpGroupParams.safeParse(req.params);
  const parsed = UpdateIlpGroupBody.strict().safeParse(req.body);
  if (!params.success || !Number.isInteger(params.data.id) || !parsed.success || !parsed.data.name.trim()) { res.status(400).json({ error: inputError }); return; }
  const [saved] = await db.update(groups).set({ ...parsed.data, name: parsed.data.name.trim() }).where(eq(groups.id, params.data.id)).returning();
  if (!saved) { res.status(404).json({ error: "Group not found" }); return; }
  res.json(UpdateIlpGroupResponse.parse(await output(saved)));
});

router.delete("/termly-ilps/groups/:id", async (req, res): Promise<void> => {
  const params = DeleteIlpGroupParams.safeParse(req.params);
  if (!params.success || !Number.isInteger(params.data.id)) { res.status(400).json({ error: "Invalid group identifier" }); return; }
  // No group FK exists on templates, terms, assignments or learner reviews.
  // The form catalogue is display-only, not an invented deletion dependency.
  const [deleted] = await db.delete(groups).where(and(eq(groups.id, params.data.id), isNull(groups.defaultYear))).returning();
  if (!deleted) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, params.data.id));
    res.status(existing ? 409 : 404).json({ error: existing ? "Year 7–11 default groups cannot be deleted" : "Group not found" });
    return;
  }
  res.sendStatus(204);
});
export default router;