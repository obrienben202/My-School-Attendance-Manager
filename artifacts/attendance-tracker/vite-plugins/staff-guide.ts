import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Publish only reader-facing assets, never authoring scripts or symlinks.
export function listGuideFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "src") return [];
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return listGuideFiles(root, filename);
    if (!entry.isFile() || !CONTENT_TYPES[path.extname(entry.name)]) return [];
    return [path.relative(root, filename).split(path.sep).join("/")];
  }).sort();
}

export function createGuideMiddleware(root: string, basePath: string) {
  const prefix = `${basePath.replace(/\/?$/, "/")}staff-guide/`;
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (!pathname.startsWith(prefix)) return next();
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      return res.end("Method not allowed");
    }
    let filename: string;
    try {
      filename = decodeURIComponent(pathname.slice(prefix.length)) || "index.html";
    } catch {
      res.statusCode = 400;
      return res.end("Invalid guide address");
    }
    try {
      // An exact inventory match blocks traversal and non-public source files.
      if (!listGuideFiles(root).includes(filename)) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.end("Guide page not found. Open staff-guide/index.html to browse the guide.");
      }
      res.setHeader("Content-Type", CONTENT_TYPES[path.extname(filename)]);
      res.setHeader("Cache-Control", "no-store");
      return res.end(req.method === "HEAD" ? undefined : readFileSync(path.join(root, filename)));
    } catch (error) {
      next(error);
    }
  };
}

export function staffGuidePlugin(root: string, basePath: string): Plugin {
  return {
    name: "staff-guide-pages",
    configureServer(server) {
      server.middlewares.use(createGuideMiddleware(root, basePath));
    },
    generateBundle() {
      for (const filename of listGuideFiles(root)) {
        this.emitFile({
          type: "asset",
          fileName: `staff-guide/${filename}`,
          source: readFileSync(path.join(root, filename)),
        });
      }
    },
  };
}