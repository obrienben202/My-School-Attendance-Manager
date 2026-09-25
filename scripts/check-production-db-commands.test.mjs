import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("./check-production-db-commands.mjs", import.meta.url));

function fixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), "prod-db-guard-"));
  const put = (name, content) => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  put("package.json", JSON.stringify({ name: "workspace" }));
  put("artifacts/api/package.json", JSON.stringify({
    name: "@workspace/api",
    scripts: { build: "node ./build.mjs" },
  }));
  put("artifacts/api/build.mjs", "console.log('bundle only');\n");
  put("scripts/post-merge.sh", "pnpm --filter @workspace/db run migrate:development\n");
  put("artifacts/api/.replit-artifact/artifact.toml", `
[services.production.build]
args = ["bash", "scripts/prod-build-api.sh"]
[services.production.run]
args = ["node", "artifacts/api/dist/index.mjs"]
[services.development]
run = "pnpm --filter @workspace/db run migrate:development"
`);
  put("scripts/prod-build-api.sh", "pnpm --filter @workspace/api run build\n");
  try {
    run({ root, put });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function check(root) {
  try {
    return { output: execFileSync(process.execPath, [checker, root], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), failed: false };
  } catch (error) {
    return { output: error.stderr.toString(), failed: true };
  }
}

test("permits a clean build and development-only post-merge migrations", () => {
  fixture(({ root }) => assert.equal(check(root).failed, false));
});

test("rejects Drizzle push in a referenced production build shell script", () => {
  fixture(({ root, put }) => {
    put("scripts/prod-build-api.sh", "pnpm --filter @workspace/api run build\ndrizzle-kit push --force\n");
    assert.match(check(root).output, /Drizzle schema mutation/);
  });
});

test("rejects migration runners through package scripts", () => {
  fixture(({ root, put }) => {
    put("artifacts/api/package.json", JSON.stringify({
      name: "@workspace/api", scripts: { build: "pnpm --filter @workspace/db run migrate:development" },
    }));
    const result = check(root);
    assert.equal(result.failed, true);
    assert.match(result.output, /database migration command/);
  });
});

test("rejects SQL execution and DDL in a production startup command", () => {
  fixture(({ root, put }) => {
    put("artifacts/api/.replit-artifact/artifact.toml", `
[services.production]
build = ["pnpm", "--filter", "@workspace/api", "run", "build"]
[services.production.run]
args = ["bash", "scripts/start.sh"]
`);
    put("scripts/start.sh", "psql \"$DATABASE_URL\" --file scripts/schema.sql\nnode artifacts/api/dist/index.mjs\n");
    put("scripts/schema.sql", "ALTER TABLE learners ADD COLUMN foo text;\n");
    const result = check(root);
    assert.equal(result.failed, true);
    assert.match(result.output, /direct SQL execution/);
    assert.match(result.output, /Replit Publish/);
  });
});

test("rejects direct DDL in a shell script reached from deployment post-build", () => {
  fixture(({ root, put }) => {
    put(".replit", '[deployment.postBuild]\nargs = ["bash", "scripts/after-build.sh"]\n');
    put("scripts/after-build.sh", 'psql -c "CREATE TABLE unsafe (id integer);"\n');
    const result = check(root);
    assert.equal(result.failed, true);
    assert.match(result.output, /direct DDL/);
    assert.match(result.output, /scripts\/after-build\.sh/);
  });
});

test("follows an unfiltered root package build script", () => {
  fixture(({ root, put }) => {
    put("package.json", JSON.stringify({
      name: "workspace", scripts: { build: "drizzle-kit push --force" },
    }));
    put(".replit", '[deployment.build]\nargs = ["pnpm", "run", "build"]\n');
    const result = check(root);
    assert.equal(result.failed, true);
    assert.match(result.output, /package\.json:build/);
  });
});