import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createGuideMiddleware, listGuideFiles, staffGuidePlugin } from "../../vite-plugins/staff-guide.ts";

test("standalone guide pages and shared assets serve under the artifact prefix without exposing source files", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "staff-guide-"));
  mkdirSync(path.join(root, "topics"));
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src", "original-index.html"), "Authoring archive, not a public topic");
  writeFileSync(path.join(root, "index.html"), "<h1>Guide contents</h1>");
  writeFileSync(path.join(root, "topics", "courses.html"), "<h1>My Courses</h1>");
  writeFileSync(path.join(root, "guide.css"), "body { color: black; }");
  writeFileSync(path.join(root, "guide.js"), "console.log('guide');");
  writeFileSync(path.join(root, "author.mjs"), "Not a public guide asset");
  symlinkSync(path.join(root, "author.mjs"), path.join(root, "linked.html"));
  const middleware = createGuideMiddleware(root, "/school/");
  const server = createServer((req, res) => middleware(req, res, () => {
    res.statusCode = 418;
    res.end("Non-guide route");
  }));
  try {
    const files = listGuideFiles(root);
    assert.deepEqual(files, ["guide.css", "guide.js", "index.html", "topics/courses.html"]);
    // Every public file, including nested topics, must be included in production.
    const plugin = staffGuidePlugin(root, "/school/");
    const emitted: { fileName: string; source: Buffer }[] = [];
    const hook = typeof plugin.generateBundle === "function" ? plugin.generateBundle : plugin.generateBundle.handler;
    hook.call({ emitFile(asset: { fileName: string; source: Buffer }) { emitted.push(asset); } }, {}, {}, false);
    assert.deepEqual(emitted.map(asset => asset.fileName), files.map(file => `staff-guide/${file}`));
    assert.equal(emitted.find(asset => asset.fileName.endsWith("courses.html"))?.source.toString(), "<h1>My Courses</h1>");
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const contents = await fetch(`${base}/school/staff-guide/`);
    assert.equal(contents.status, 200);
    assert.match(await contents.text(), /Guide contents/);
    const topic = await fetch(`${base}/school/staff-guide/topics/courses.html?from=help`);
    assert.equal(topic.status, 200);
    assert.match(topic.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(await topic.text(), "<h1>My Courses</h1>");
    const css = await fetch(`${base}/school/staff-guide/guide.css`);
    assert.match(css.headers.get("content-type") ?? "", /text\/css/);
    const js = await fetch(`${base}/school/staff-guide/guide.js`);
    assert.match(js.headers.get("content-type") ?? "", /javascript/);
    for (const suffix of ["missing.html", "author.mjs", "linked.html", "src/original-index.html", "%2e%2e%2fauthor.mjs"]) {
      assert.equal((await fetch(`${base}/school/staff-guide/${suffix}`)).status, 404, suffix);
    }
    assert.equal((await fetch(`${base}/school/staff-guide/%ZZ`)).status, 400);
    assert.equal((await fetch(`${base}/school/staff-guide/index.html`, { method: "HEAD" })).status, 200);
    assert.equal((await fetch(`${base}/school/staff-guide/index.html`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base}/school/courses`)).status, 418);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});