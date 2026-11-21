import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isShareableSource, syncGithub } from "./sync-github.mjs";

test("source selection excludes school data, browser sessions, secrets and generated output", () => {
  for (const name of [
    "attached_assets/school.pdf", "screenshots/register.png", ".agents/memory/MEMORY.md",
    "artifacts/app/.auth/state.json", "artifacts/app/storage-state.json",
    "artifacts/app/credentials.json", "artifacts/app/.env.production",
    "artifacts/app/dist/index.js", "artifacts/app/node_modules/dependency.js",
    "artifacts/app/private.csv", "artifacts/app/session.har", ".replit",
    "artifacts/../../attached_assets/notes.ts",
  ]) assert.equal(isShareableSource(name), false, name);
  for (const name of [
    "README.md", "package.json", "artifacts/app/src/page.tsx",
    "lib/db/migrations/0007_add_safeguarding_notes.sql", "staff-guide/images/attendance.svg",
    "scripts/sync-github.mjs",
  ]) assert.equal(isShareableSource(name), true, name);
});

test("divergent branches sync safely, repeat cleanly, and reject conflicting GitHub edits and credentials", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "github-sync-test-"));
  const origin = path.join(root, "origin.git"), local = path.join(root, "local"), other = path.join(root, "other");
  const git = (cwd, ...args) => execFileSync("git", [
    "-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args,
  ], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const put = (cwd, name, text) => {
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    writeFileSync(path.join(cwd, name), text);
  };
  try {
    mkdirSync(local);
    git(root, "init", "--bare", "--initial-branch=main", origin);
    git(local, "init", "--initial-branch=main");
    put(local, "package.json", '{"name":"synthetic-test"}\n');
    put(local, "artifacts/app/src/page.ts", "export const value = 1;\n");
    put(local, "attached_assets/existing-private.txt", "synthetic existing school upload\n");
    git(local, "add", ".");
    git(local, "add", "-f", "attached_assets/existing-private.txt");
    git(local, "commit", "-m", "Initial");
    git(local, "remote", "add", "origin", origin); git(local, "push", "-u", "origin", "main");
    git(root, "clone", origin, other);
    put(other, "README.md", "Remote documentation\n");
    git(other, "add", "."); git(other, "commit", "-m", "Remote-only docs"); git(other, "push");
    put(local, "README.md", "Remote documentation\n");
    put(local, "artifacts/app/src/page.ts", "export const value = 2;\n");
    put(local, "attached_assets/new-private.txt", "synthetic new school upload\n");
    git(local, "add", ".");
    git(local, "add", "-f", "attached_assets/new-private.txt");
    git(local, "commit", "-m", "Local source and private fixture");
    const localHead = git(local, "rev-parse", "HEAD");
    put(local, "README.md", "Remote documentation\nNew working instructions\n");
    const result = syncGithub({ cwd: local });
    assert.deepEqual(result.changed, ["README.md", "artifacts/app/src/page.ts"]);
    assert.equal(git(local, "rev-parse", "HEAD"), localHead);
    assert.equal(readFileSync(path.join(local, "attached_assets/new-private.txt"), "utf8"), "synthetic new school upload\n");
    const files = git(origin, "ls-tree", "-r", "--name-only", "main").split("\n");
    assert.ok(files.includes("attached_assets/existing-private.txt"), files.join(", "));
    assert.ok(!files.includes("attached_assets/new-private.txt"));
    assert.equal(git(origin, "show", "main:artifacts/app/src/page.ts"), "export const value = 2;");
    assert.throws(() => git(origin, "merge-base", "--is-ancestor", localHead, "main"));
    assert.deepEqual(syncGithub({ cwd: local }).changed, []);

    // Uncommitted source is included, but untracked private uploads are not.
    put(local, "artifacts/app/src/new.ts", "export const example = true;\n");
    put(local, "screenshots/private.png", "synthetic screenshot fixture");
    assert.deepEqual(syncGithub({ cwd: local }).changed, ["artifacts/app/src/new.ts"]);
    const stable = git(origin, "rev-parse", "main");
    put(local, "artifacts/app/src/key.ts", "export const token = '" + "ghp_" + "x".repeat(36) + "';\n");
    assert.throws(() => syncGithub({ cwd: local }), /possible credential/);
    assert.equal(git(origin, "rev-parse", "main"), stable);
    rmSync(path.join(local, "artifacts/app/src/key.ts"));

    git(other, "pull", "--ff-only");
    put(other, "artifacts/app/src/page.ts", "export const value = 999;\n");
    git(other, "add", "."); git(other, "commit", "-m", "External GitHub source edit"); git(other, "push");
    const external = git(origin, "rev-parse", "main");
    assert.throws(() => syncGithub({ cwd: local }), /GitHub also changed/);
    assert.equal(git(origin, "rev-parse", "main"), external);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
