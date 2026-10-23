import { Readable } from "node:stream";
import { Router, type Request, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { db, enrolmentPhotoUploadsTable, enrollmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireConciergeAccess } from "../lib/concierge-access";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!requireConciergeAccess(req, res)) return;
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a file name, size, and image content type." });
  if (!["image/jpeg", "image/png"].includes(parsed.data.contentType)) {
    return res.status(400).json({ error: "Only JPEG and PNG images are accepted." });
  }
  try {
    const [enrolment] = await db
      .select({ id: enrollmentsTable.id })
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.id, parsed.data.enrolmentId));
    if (!enrolment) return res.status(404).json({ error: "Enrolment not found." });
    const { uploadURL, objectPath } = await storage.createEnrolmentPhotoUpload(enrolment.id);
    await db.insert(enrolmentPhotoUploadsTable).values({
      enrollmentId: enrolment.id,
      objectPath,
      requestedBy: req.user.id,
      expectedContentType: parsed.data.contentType,
      expectedSize: parsed.data.size,
    });
    return res.json(RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      metadata: parsed.data,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create learner photo upload URL");
    return res.status(500).json({ error: "Photo storage is unavailable. Try again later." });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  if (!requireConciergeAccess(req, res)) return;
  try {
    const raw = req.params.path;
    const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
    const [association] = await db
      .select({ id: enrollmentsTable.id })
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.photoObjectPath, objectPath));
    if (!association) return res.status(404).json({ error: "Object not found" });
    const response = await storage.downloadObject(await storage.getObjectEntityFile(objectPath));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
    return;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return res.status(404).json({ error: "Object not found" });
    req.log.error({ err: error }, "Failed to serve stored object");
    return res.status(500).json({ error: "Failed to serve stored object" });
  }
});

export default router;