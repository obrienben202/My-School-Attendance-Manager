import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    "artifacts/app/private.csv", "artifacts/app/session.har",
    "artifacts/../../attached_assets/notes.ts",
  ]) assert.equal(isShareableSource(name), false, name);
  for (const name of [
    "README.md", "package.json", ".replit", "artifacts/app/src/page.tsx",
    "lib/db/migrations/0007_add_safeguarding_notes.sql", "staff-guide/images/attendance.svg",
    "scripts/sync-github.mjs",
    "google-apps-script-portal/src/Code.gs", "google-apps-script-portal/src/appsscript.json",
  ]) assert.equal(isShareableSource(name), true, name);
  for (const name of ["google-apps-script-portal/.clasp.json", "google-apps-script-portal/school-export.json", "google-apps-script-portal/script-properties.json"]) assert.equal(isShareableSource(name), false);
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
    put(local, ".replit", '[postMerge]\ntimeoutMs=20000\n[objectStorage]\ndefaultBucketID="synthetic-remote-bucket"\n');
    put(local, "artifacts/app/src/page.ts", "export const value = 1;\n");
    put(local, "attached_assets/existing-private.txt", "synthetic existing school upload\n");
    git(local, "add", ".");
    git(local, "add", "-f", "attached_assets/existing-private.txt");
    git(local, "commit", "-m", "Initial");
    git(local, "remote", "add", "origin", origin); git(local, "push", "-u", "origin", "main");
    git(local, "tag", "github-ready");
    git(local, "push", "origin", "refs/tags/github-ready");
    const savedTag = git(origin, "rev-parse", "refs/tags/github-ready");
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
    put(local, ".replit", '[postMerge]\ntimeoutMs=180000\n[objectStorage]\ndefaultBucketID="synthetic-new-local-bucket"\n');
    const result = syncGithub({ cwd: local });
    assert.deepEqual(result.changed, [".replit", "README.md", "artifacts/app/src/page.ts"]);
    assert.equal(git(local, "rev-parse", "HEAD"), localHead);
    assert.equal(readFileSync(path.join(local, "attached_assets/new-private.txt"), "utf8"), "synthetic new school upload\n");
    const files = git(origin, "ls-tree", "-r", "--name-only", "main").split("\n");
    assert.ok(files.includes("attached_assets/existing-private.txt"), files.join(", "));
    assert.ok(!files.includes("attached_assets/new-private.txt"));
    assert.equal(git(origin, "show", "main:artifacts/app/src/page.ts"), "export const value = 2;");
    const config = git(origin, "show", "main:.replit");
    assert.match(config, /timeoutMs=180000/);
    assert.match(config, /synthetic-remote-bucket/);
    assert.doesNotMatch(config, /synthetic-new-local-bucket/);
    assert.throws(() => git(origin, "merge-base", "--is-ancestor", localHead, "main"));
    assert.deepEqual(syncGithub({ cwd: local }).changed, []);
    assert.equal(git(origin, "rev-parse", "refs/tags/github-ready"), savedTag);

    // Uncommitted source is included, but untracked private uploads are not.
    put(local, "artifacts/app/src/new.ts", "export const example = true;\n");
    put(local, "screenshots/private.png", "synthetic screenshot fixture");
    assert.deepEqual(syncGithub({ cwd: local }).changed, ["artifacts/app/src/new.ts"]);
    const stable = git(origin, "rev-parse", "main");
    put(local, "artifacts/app/src/key.ts", "export const token = '" + "ghp_" + "x".repeat(36) + "';\n");
    assert.throws(() => syncGithub({ cwd: local }), /possible credential/);
    assert.equal(git(origin, "rev-parse", "main"), stable);
    rmSync(path.join(local, "artifacts/app/src/key.ts"));

    // Simulate the separately approved repair, only inside this synthetic repo.
    git(local, "reset", "--mixed", "refs/remotes/origin/main");
    put(local, ".replit", `${git(origin, "show", "main:.replit")}\n`);
    git(local, "config", "githubSync.normalPush", "true");
    put(local, "README.md", "A normal aligned source update\n");
    syncGithub({ cwd: local });
    assert.equal(git(local, "rev-parse", "HEAD"), git(origin, "rev-parse", "main"));
    assert.ok(!git(local, "status", "--porcelain").includes("README.md"));
    put(local, "artifacts/app/src/page.ts", "export const value = 3;\n");
    git(local, "add", "artifacts/app/src/page.ts"); git(local, "commit", "-m", "Normal manual edit");
    const manualHead = git(local, "rev-parse", "HEAD");
    git(local, "push");
    assert.equal(git(origin, "rev-parse", "main"), manualHead);
    put(local, "README.md", "A source update after a manual push\n");
    syncGithub({ cwd: local });
    assert.equal(git(local, "rev-parse", "HEAD"), git(origin, "rev-parse", "main"));
    assert.deepEqual(syncGithub({ cwd: local }).changed, []);
    assert.equal(git(origin, "rev-parse", "refs/tags/github-ready"), savedTag);

    git(other, "pull", "--ff-only");
    put(other, "artifacts/app/src/page.ts", "export const value = 999;\n");
    git(other, "add", "."); git(other, "commit", "-m", "External GitHub source edit"); git(other, "push");
    const external = git(origin, "rev-parse", "main");
    assert.throws(() => syncGithub({ cwd: local }), /not aligned|GitHub also changed/);
    assert.equal(git(origin, "rev-parse", "main"), external);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("task-merge setup syncs GitHub after successful preparation and stops if preparation fails", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "github-hook-test-"));
  const hook = path.resolve("scripts/post-merge.sh");
  const calls = path.join(temp, "calls");
  const fakePnpm = path.join(temp, "pnpm");
  try {
    writeFileSync(fakePnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALL_LOG"\nif [ "$*" = "--filter @workspace/db run migrate:development" ] && [ "${FAIL_MIGRATION:-0}" = 1 ]; then exit 1; fi\n');
    chmodSync(fakePnpm, 0o755);
    const env = { ...process.env, PATH: `${temp}:${process.env.PATH}`, CALL_LOG: calls };
    execFileSync("bash", [hook], { env });
    assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n"), [
      "install --frozen-lockfile", "--filter @workspace/db run migrate:development", "github:sync",
    ]);
    writeFileSync(calls, "");
    assert.throws(() => execFileSync("bash", [hook], { env: { ...env, FAIL_MIGRATION: "1" } }));
    assert.doesNotMatch(readFileSync(calls, "utf8"), /github:sync/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
