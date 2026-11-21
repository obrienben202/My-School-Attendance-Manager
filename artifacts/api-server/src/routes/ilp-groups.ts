import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, ilpGroupsTable as groups, studentsTable, type IlpGroup } from "@workspace/db";
import {
  ListIlpGroupsResponse, ListIlpGroupsResponseItem, CreateIlpGroupBody,
  UpdateIlpGroupBody, UpdateIlpGroupParams, UpdateIlpGroupResponse, DeleteIlpGroupParams,
  DeleteIlpGroupQueryParams,
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
    id: group.id, name: group.name, filters: group.filters, revision: group.revision, defaultYear: group.defaultYear,
    createdBy: group.createdBy, createdAt: group.createdAt.toISOString(),
    learnerCount: roster.filter(s => groupMatchesYear(group.filters, s.yearGroup)).length,
  };
}
const inputError = "Invalid group: use a non-blank name (up to 120 characters) and only Year Group filters, equals or is not, with Year 7–11. Course, Attendance %, Status, Faculty and Gender are not supported.";

// The mutation itself compares revisions in SQL; a separate read/check/write would race.
async function conflict(id: number) {
  const [current] = await db.select().from(groups).where(eq(groups.id, id));
  return {
    status: current ? 409 : 404,
    body: {
      error: current ? "Another administrator changed this group. Review the latest saved version before trying again." : "This group has been deleted. Your unsaved changes have not been saved.",
      code: current ? "GROUP_REVISION_CONFLICT" : "GROUP_NOT_FOUND",
      current: current ? await output(current) : null,
    },
  };
}

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
  if (!params.success || !Number.isInteger(params.data.id) || !parsed.success || !Number.isInteger(parsed.data.revision) || !parsed.data.name.trim()) { res.status(400).json({ error: `${inputError} Updates also require the current integer revision.` }); return; }
  const [saved] = await db.update(groups).set({
    name: parsed.data.name.trim(), filters: parsed.data.filters,
    revision: sql`${groups.revision} + 1`,
  }).where(and(eq(groups.id, params.data.id), eq(groups.revision, parsed.data.revision))).returning();
  if (!saved) { const result = await conflict(params.data.id); res.status(result.status).json(result.body); return; }
  res.json(UpdateIlpGroupResponse.parse(await output(saved)));
});

router.delete("/termly-ilps/groups/:id", async (req, res): Promise<void> => {
  const params = DeleteIlpGroupParams.safeParse(req.params);
  const query = DeleteIlpGroupQueryParams.safeParse(req.query);
  if (!params.success || !Number.isInteger(params.data.id) || typeof req.query.revision !== "string" || !/^(0|[1-9]\d*)$/.test(req.query.revision) || !query.success || !Number.isInteger(query.data.revision)) { res.status(400).json({ error: "A valid group identifier and current integer revision are required" }); return; }
  // No group FK exists on templates, terms, assignments or learner reviews.
  // The form catalogue is display-only, not an invented deletion dependency.
  const [deleted] = await db.delete(groups).where(and(eq(groups.id, params.data.id), eq(groups.revision, query.data.revision), isNull(groups.defaultYear))).returning();
  if (!deleted) {
    const [existing] = await db.select().from(groups).where(eq(groups.id, params.data.id));
    if (existing?.defaultYear != null) {
      res.status(409).json({ error: "Year 7–11 default groups cannot be deleted", code: "GROUP_PROTECTED", current: await output(existing) });
      return;
    }
    const result = await conflict(params.data.id);
    res.status(result.status).json(result.body);
    return;
  }
  res.sendStatus(204);
});
export default router;