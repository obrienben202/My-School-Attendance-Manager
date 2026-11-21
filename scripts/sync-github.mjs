// Upload source changes without pushing this workspace's private local history.
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FILES = new Set([
  ".gitignore", ".npmrc", ".replit", ".replitignore", "replit.md", "README.md", "SECURITY.md", "package.json",
  "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json",
  "pyproject.toml", "uv.lock",
]);
const SOURCE_ROOTS = new Set(["artifacts", "lib", "scripts", "staff-guide"]);
const PRIVATE_PARTS = new Set([
  ".agents", ".auth", ".git", ".local", "attached_assets", "screenshots",
  "node_modules", "dist", "generated-artifacts", "coverage",
]);
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json",
  ".yaml", ".yml", ".md", ".html", ".css", ".scss", ".svg", ".sh", ".sql",
  ".toml", ".lock",
]);

export function isShareableSource(filename) {
  const parts = filename.split("/");
  if (parts.some(p => p === ".." || PRIVATE_PARTS.has(p))) return false;
  if (filename === "staff-guide/src/original-index.html") return false;
  if (parts.some(p => p.startsWith(".env"))) return false;
  if (/(?:storage.?state|auth.?state|credentials|service.?account)\.json$/i.test(filename)) return false;
  if (ROOT_FILES.has(filename)) return true;
  if (!SOURCE_ROOTS.has(parts[0])) return false;
  // This existing branding image contains only the generic sign-in screen.
  if (filename === "artifacts/attendance-tracker/public/opengraph.jpg") return true;
  return parts.at(-1) === ".gitkeep" || SOURCE_EXTENSIONS.has(path.posix.extname(filename));
}

function checkSource(filename, content) {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /AKIA[0-9A-Z]{16}/,
    /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/,
    /"private_key"\s*:\s*"[^"]+-----BEGIN/,
  ];
  if (content.length > 5_000_000 || patterns.some(p => p.test(content.toString("utf8")))) {
    throw new Error(`Upload stopped: review the size or possible credential in ${filename}. No credential value was printed.`);
  }
}

export function syncGithub({ cwd = process.cwd(), remote = "origin" } = {}) {
  const git = (args, { raw = false, ...options } = {}) => {
    const result = execFileSync("git", args, {
      cwd, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
      timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["pipe", "pipe", "pipe"], ...options,
    });
    return raw ? result : result.trimEnd();
  };
  const optional = (args, options) => {
    try { return git(args, options); } catch { return null; }
  };
  const split = text => text.split("\0").filter(Boolean);
  const advertised = git(["ls-remote", "--symref", remote, "HEAD"]);
  const branch = advertised.match(/^ref: refs\/heads\/([^\t\n]+)\s+HEAD$/m)?.[1];
  if (!branch) throw new Error("Cannot identify the default GitHub branch. Check the origin connection.");
  const tracking = `refs/remotes/${remote}/${branch}`;
  git(["fetch", "--no-tags", remote, `refs/heads/${branch}:${tracking}`]);
  const target = git(["rev-parse", tracking]);
  const normalPush = optional(["config", "--local", "--get", "githubSync.normalPush"]) === "true";
  const head = git(["rev-parse", "HEAD"]);
  const aligned = optional(["merge-base", "--is-ancestor", target, head]) !== null;
  if (normalPush && (optional(["symbolic-ref", "-q", "HEAD"]) !== `refs/heads/${branch}` || !aligned)) {
    throw new Error("The working branch is not aligned with GitHub. Review or pull the remote changes before updating; no history was rewritten.");
  }
  const previousUpload = optional(["rev-parse", "--verify", "refs/github-sync/last-upload"]);
  const comparisonBase = previousUpload ?? optional(["merge-base", "HEAD", target]);
  if (!comparisonBase) throw new Error("No shared working history. Do not push the saved clean tag as a working branch.");
  if (previousUpload && optional(["merge-base", "--is-ancestor", previousUpload, target]) === null) {
    throw new Error("GitHub history changed since the last upload. Review it before syncing; nothing was force-pushed.");
  }
  const listed = new Set(split(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])));
  const sources = [...listed].filter(isShareableSource);
  const content = new Map();
  for (const filename of sources) {
    const full = path.join(cwd, filename);
    let stat;
    try { stat = lstatSync(full); } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing a non-regular source file: ${filename}`);
    let bytes = readFileSync(full);
    if (filename === ".replit") {
      // Sync operational settings, not a newly changed installation's bucket.
      const section = /^\[objectStorage\][\s\S]*?(?=^\[|(?![\s\S]))/m;
      const existing = optional(["show", `${target}:.replit`], { raw: true })?.match(section)?.[0] ?? "";
      const source = bytes.toString("utf8");
      bytes = Buffer.from(section.test(source)
        ? source.replace(section, existing)
        : `${source}${existing ? `\n${existing}\n` : ""}`);
    }
    checkSource(filename, bytes);
    content.set(filename, bytes);
  }
  const remoteChanges = split(git(["diff", "--name-only", "-z", comparisonBase, target]));
  for (const filename of remoteChanges.filter(isShareableSource)) {
    const remoteBlob = optional(["rev-parse", "--verify", `${target}:${filename}`]);
    const localBlob = content.has(filename)
      ? git(["hash-object", "--stdin"], { input: content.get(filename) })
      : null;
    if (remoteBlob !== localBlob) {
      // A squashed documentation PR can have the same content as local HEAD
      // without sharing that commit. Working edits based on that content are safe.
      const alreadyPresent = (!previousUpload || (normalPush && aligned)) &&
        remoteBlob === optional(["rev-parse", "--verify", `HEAD:${filename}`]);
      if (alreadyPresent) continue;
      throw new Error(`GitHub also changed ${filename}. Review that change first; this command will not overwrite it.`);
    }
  }
  const temporary = mkdtempSync(path.join(tmpdir(), "school-github-sync-"));
  let commit = target, changed = [];
  try {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_INDEX_FILE: path.join(temporary, "index") };
    const indexGit = (args, options) => git(args, { env, ...options });
    indexGit(["read-tree", target]);
    const remoteFiles = split(git(["ls-tree", "-r", "--name-only", "-z", target]));
    for (const filename of remoteFiles.filter(isShareableSource)) {
      if (!content.has(filename)) indexGit(["update-index", "--force-remove", "--", filename]);
    }
    for (const [filename, bytes] of content) {
      const hash = git(["hash-object", "-w", "--stdin"], { input: bytes });
      const executable = (lstatSync(path.join(cwd, filename)).mode & 0o111) !== 0;
      indexGit(["update-index", "--add", "--cacheinfo", `${executable ? "100755" : "100644"},${hash},${filename}`]);
    }
    const tree = indexGit(["write-tree"]);
    changed = split(git(["diff", "--name-only", "-z", target, tree]));
    if (changed.some(filename => !isShareableSource(filename))) throw new Error("Private-path guard failed. Upload stopped.");
    if (normalPush) {
      // Never reintroduce private local history through the repaired normal branch.
      const outgoing = split(git(["log", "-z", "--format=", "--name-only", "--diff-filter=AM", `${target}..HEAD`]))
        .flatMap(part => part.split("\n")).filter(Boolean);
      if (outgoing.some(filename => !isShareableSource(filename))) {
        throw new Error("New local commits contain private paths. Review them before a normal push; nothing was uploaded.");
      }
      const pending = split(git(["diff", "--name-only", "-z", head, tree]));
      if (pending.some(filename => !isShareableSource(filename))) {
        throw new Error("The local index needs review before updating. No private paths were committed.");
      }
      for (const filename of pending) {
        const bytes = content.get(filename);
        if (bytes && !readFileSync(path.join(cwd, filename)).equals(bytes)) {
          throw new Error(`Review installation-specific settings in ${filename} before committing them.`);
        }
      }
      if (pending.length) {
        const input = `${pending.join("\0")}\0`;
        git(["add", "--intent-to-add", "--pathspec-from-file=-", "--pathspec-file-nul"], { input });
        git(["-c", "user.name=Replit Agent", "-c", "user.email=agent@replit.com",
          "commit", "--only", "-m", "Update application source and documentation",
          "--pathspec-from-file=-", "--pathspec-file-nul"], { input });
      }
      commit = git(["rev-parse", "HEAD"]);
      if (git(["rev-parse", `${commit}^{tree}`]) !== tree) {
        throw new Error("The working branch changed during syncing. Review before retrying; nothing was pushed.");
      }
      if (commit !== target) git(["push", remote, `${commit}:refs/heads/${branch}`]);
    } else if (changed.length) {
      commit = git([
        "-c", "user.name=Replit Agent", "-c", "user.email=agent@replit.com",
        "commit-tree", tree, "-p", target,
      ], { input: "Sync current application source and documentation safely\n" });
      // A normal fast-forward push rejects concurrent remote changes.
      git(["push", remote, `${commit}:refs/heads/${branch}`]);
    }
    const actual = git(["ls-remote", remote, `refs/heads/${branch}`]).split(/\s/)[0];
    if (actual !== commit) throw new Error("GitHub changed during verification. Refresh before retrying.");
    git(["update-ref", "refs/github-sync/last-upload", commit]);
    git(["update-ref", tracking, commit]);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return { branch, commit, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = syncGithub();
    console.log(result.changed.length
      ? `GitHub updated: ${result.changed.length} source files on ${result.branch} (${result.commit.slice(0, 8)}).`
      : `GitHub is already up to date on ${result.branch}.`);
    console.log("Local files, storage settings and saved tags were preserved; existing commits were not rewritten.");
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    console.error(`GitHub update stopped safely: ${detail.replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, "https://[redacted]@")}`);
    process.exitCode = 1;
  }
}
