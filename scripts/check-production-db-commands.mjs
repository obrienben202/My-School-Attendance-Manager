import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(process.argv[2] ?? root);

function read(relative) {
  return readFileSync(path.join(projectRoot, relative), "utf8");
}

function filesUnder(relative, predicate) {
  const directory = path.join(projectRoot, relative);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(name, predicate) : predicate(name) ? [name] : [];
  });
}

// Read only production command sections; development and post-merge are intentionally out of scope.
function productionCommands(toml) {
  const commands = [];
  let section = "";
  for (const line of toml.split("\n")) {
    const header = line.match(/^\s*\[([^\]]+)\]/);
    if (header) {
      section = header[1];
      continue;
    }
    if (!/^services\.production(?:\.(?:build|run))?$/.test(section)) continue;
    const value = line.match(/^\s*(?:args|build|run)\s*=\s*(.+?)\s*(?:#.*)?$/);
    if (value) {
      const raw = value[1].trim();
      commands.push(raw.startsWith("[") ? JSON.parse(raw).join(" ") : raw);
    }
  }
  return commands;
}

const packages = new Map();
for (const file of ["package.json", ...filesUnder("artifacts", (name) => name.endsWith("/package.json")), ...filesUnder("lib", (name) => name.endsWith("/package.json"))]) {
  const pkg = JSON.parse(read(file));
  if (pkg.name) packages.set(pkg.name, { file, scripts: pkg.scripts ?? {} });
}

const violations = [];
const visited = new Set();
const patterns = [
  [/\bdrizzle-kit\s+(?:push|migrate)\b/i, "Drizzle schema mutation"],
  [/\b(?:prisma\s+(?:db\s+push|migrate\s+deploy)|knex\s+migrate|sequelize\s+db:migrate)\b/i, "migration runner"],
  [/\b(?:db:push|push-force|migrat(?:e|ion)(?::[\w-]+)?)\b/i, "database migration command"],
  [/\bpsql\b/i, "direct SQL execution"],
  [/\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|INDEX|SCHEMA|TYPE|VIEW|SEQUENCE|DATABASE)\b/i, "direct DDL"],
  [/\b(?:node|tsx|bash|sh)\s+[^;&|]*\b(?:migrat(?:e|ion)|schema-push|db-push)[\w./-]*\.(?:[cm]?[jt]s|sh|sql)\b/i, "migration script"],
];

function inspect(text, origin, baseDir = ".", currentPackage = packages.get("workspace")) {
  // Ignore full-line comments, but inspect the actual commands and their referenced scripts.
  const executable = text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  for (const [pattern, reason] of patterns) {
    if (pattern.test(executable)) violations.push(`${origin}: ${reason}`);
  }
  for (const match of executable.matchAll(/\bpnpm\s+(?:--filter\s+([@\w./-]+)\s+)?(?:run\s+)?([\w:-]+)\b/g)) {
    const [, filter, script] = match;
    const pkg = filter ? packages.get(filter) : currentPackage;
    if (pkg) inspectPackage(pkg, script);
  }
  for (const match of executable.matchAll(/\b(?:bash|sh|node|source)\s+(?:--[\w-]+\s+)*(\.?\.?\/?[\w./-]+\.(?:sh|mjs|cjs|js|sql))\b/g)) {
    inspectFile(path.join(baseDir, match[1]), origin, match[1]);
  }
  for (const match of executable.matchAll(/(?:^|\s)\.\s+(\.?\.?\/?[\w./-]+\.sh)\b/g)) {
    inspectFile(path.join(baseDir, match[1]), origin, match[1]);
  }
}

function inspectPackage(pkg, script) {
  if (!(script in pkg.scripts)) return;
  const key = `${pkg.file}:${script}`;
  if (visited.has(key)) return;
  visited.add(key);
  // pnpm scripts run relative to their package directory.
  inspect(pkg.scripts[script], key, path.dirname(pkg.file), pkg);
}

function inspectFile(relative, origin, rootRelative = relative) {
  // A shell script can call either a neighboring file or a root-relative path.
  const normalized = path.normalize(
    existsSync(path.join(projectRoot, relative)) ? relative : rootRelative,
  );
  // Bundled runtime output is not a build/startup command script. It may include
  // legitimate application queries and stale generated content.
  if (normalized.split(path.sep).includes("dist")) return;
  const key = `file:${normalized}`;
  if (visited.has(key)) return;
  if (!existsSync(path.join(projectRoot, normalized))) return;
  visited.add(key);
  if (normalized.endsWith(".sql")) {
    violations.push(`${origin} -> ${normalized}: SQL script executed during production build/startup`);
    return;
  }
  inspect(read(normalized), normalized, path.dirname(normalized));
}

for (const file of filesUnder("artifacts", (name) => name.endsWith("/.replit-artifact/artifact.toml"))) {
  for (const command of productionCommands(read(file))) inspect(command, file);
}

if (existsSync(path.join(projectRoot, ".replit"))) {
  const config = read(".replit");
  let section = "";
  for (const line of config.split("\n")) {
    const header = line.match(/^\s*\[([^\]]+)\]/);
    if (header) {
      section = header[1];
      continue;
    }
    if (!/^deployment(?:\.(?:build|postBuild|run))?$/.test(section)) continue;
    const value = line.match(/^\s*(?:args|build|run)\s*=\s*(.+?)\s*(?:#.*)?$/);
    if (value) {
      const raw = value[1].trim();
      inspect(raw.startsWith("[") ? JSON.parse(raw).join(" ") : raw, `.replit [${section}]`);
    }
  }
}

if (violations.length) {
  console.error("Production build/startup must not change the database schema:");
  for (const violation of [...new Set(violations)]) console.error(`- ${violation}`);
  console.error("Use reviewed development migrations after merge; use Replit Publish for production schema changes.");
  process.exitCode = 1;
} else {
  console.log("Production build/startup database mutation check passed.");
}