import { Router } from "express";
import { db } from "@workspace/db";
import { conciergeApplicationsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/concierge/applications", async (req, res) => {
  const { status, search } = req.query as { status?: string; search?: string };
  let rows = await db.select().from(conciergeApplicationsTable).orderBy(conciergeApplicationsTable.createdAt);

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.forename && r.forename.toLowerCase().includes(s)) ||
        (r.surname && r.surname.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s))
    );
  }

  res.json(rows);
});

router.post("/concierge/applications", async (req, res) => {
  const [row] = await db.insert(conciergeApplicationsTable).values(req.body).returning();
  res.status(201).json(row);
});

router.get("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .select()
    .from(conciergeApplicationsTable)
    .where(eq(conciergeApplicationsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.patch("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db
    .update(conciergeApplicationsTable)
    .set(req.body)
    .where(eq(conciergeApplicationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/concierge/applications/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(conciergeApplicationsTable).where(eq(conciergeApplicationsTable.id, id));
  res.status(204).send();
});

export default router;
