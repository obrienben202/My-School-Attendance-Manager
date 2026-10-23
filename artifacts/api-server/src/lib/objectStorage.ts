import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR;
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
    return dir.replace(/\/$/, "");
  }

  async createEnrolmentPhotoUpload(enrolmentId: number) {
    const objectPath = `/objects/uploads/enrolments/${enrolmentId}/${randomUUID()}`;
    const { bucketName, objectName } = parseObjectPath(
      `${this.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`,
    );
    const uploadURL = await signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
    return { uploadURL, objectPath };
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const { bucketName, objectName } = parseObjectPath(
      `${this.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`,
    );
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async downloadObject(file: File) {
    const [metadata] = await file.getMetadata();
    const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;
    const headers = new Headers({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    });
    if (metadata.size) headers.set("Content-Length", String(metadata.size));
    return new Response(stream, { headers });
  }

  async validateEnrolmentPhoto(
    objectPath: string,
    expected: { size: number; contentType: "image/jpeg" | "image/png" },
  ) {
    const file = await this.getObjectEntityFile(objectPath);
    const [[metadata], [signature]] = await Promise.all([
      file.getMetadata(),
      file.download({ start: 0, end: 15 }),
    ]);
    const size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size !== expected.size || size > 5 * 1024 * 1024) {
      throw new Error("Stored photo size does not match the issued upload.");
    }
    if (metadata.contentType !== expected.contentType) {
      throw new Error("Stored photo content type does not match the issued upload.");
    }
    const isPng =
      signature.length >= 8 &&
      signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg =
      signature.length >= 3 &&
      signature[0] === 0xff &&
      signature[1] === 0xd8 &&
      signature[2] === 0xff;
    if ((expected.contentType === "image/png" && !isPng) || (expected.contentType === "image/jpeg" && !isJpeg)) {
      throw new Error("Stored file content is not a valid JPEG or PNG image.");
    }
    return file;
  }
}

function parseObjectPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  if (parts.length < 3 || !parts[1] || !parts.slice(2).join("/")) {
    throw new Error("Invalid object path");
  }
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT";
  ttlSec: number;
}) {
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign object URL (${response.status})`);
  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url) throw new Error("Storage did not return an upload URL");
  return body.signed_url;
}