// Checks dist/ as it ships: no install-time dependencies, on Node and on Bun.
//
//   node scripts/check-dist.mjs
//
// - every export's module and declaration exist;
// - every module in dist/ imports only relative paths and `node:` built-ins;
// - every declaration an export reaches imports only relative paths and `node:` built-ins, so a TypeScript consumer
//   needs nothing installed either;
// - every export loads from a copy of the package with no node_modules, on Node and on Bun (when Bun is installed;
//   CI always has it).
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { entryPoints, reachableDeclarations, specifiers } from "./entries.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const problems = []

if (!existsSync(dist)) {
  console.error("dist/ is missing: run npm run build")
  process.exit(1)
}

const files = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

const allowed = (specifier) => specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("node:")

const entries = entryPoints(pkg, root)
for (const entry of entries) {
  for (const file of [entry.js, entry.types]) if (!existsSync(join(root, file))) problems.push(`${file} is missing: run npm run build`)
}

for (const file of files(dist).filter((path) => path.endsWith(".js"))) {
  for (const specifier of specifiers(readFileSync(file, "utf8"))) {
    if (!allowed(specifier)) problems.push(`${relative(root, file)} imports "${specifier}": dist/ may import only Node built-ins (node:...)`)
  }
}

for (const file of reachableDeclarations(pkg, dist)) {
  for (const specifier of specifiers(readFileSync(file, "utf8"))) {
    if (!allowed(specifier)) {
      problems.push(`${relative(root, file)} imports "${specifier}": a published declaration may name only the package's own types and Node's (keep zod inside; export a Validator)`)
    }
  }
}

// Load every export from a bare copy: the package as a consumer installs it, with nothing beside it.
const bare = mkdtempSync(join(tmpdir(), "source-contract-"))
try {
  const target = join(bare, "node_modules", ...pkg.name.split("/"))
  cpSync(join(root, "package.json"), join(target, "package.json"))
  cpSync(dist, join(target, "dist"), { recursive: true })
  const script = entries.map((entry) => `await import(${JSON.stringify(entry.key === "." ? pkg.name : `${pkg.name}/${entry.name}`)});`).join("\n")
  const runtimes = [["node", ["--input-type=module", "-e", script]]]
  const bun = spawnSync("bun", ["--version"], { encoding: "utf8" })
  if (bun.status === 0) runtimes.push(["bun", ["-e", script]])
  else if (process.env.CI) problems.push("Bun is not installed, and CI must load dist/ on Bun too")
  else console.warn("check-dist: Bun is not installed here, so dist/ was loaded on Node only")
  for (const [command, args] of runtimes) {
    const run = spawnSync(command, args, { cwd: bare, encoding: "utf8" })
    if (run.status !== 0) problems.push(`dist/ does not load on ${command}: ${(run.stderr || run.stdout).trim().split("\n").slice(0, 5).join(" / ")}`)
  }
} finally {
  rmSync(bare, { recursive: true, force: true })
}

if (problems.length > 0) {
  console.error(`dist/ is not what the package promises:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
console.log(`dist/ ok: ${entries.length} entries load on Node${problems.length === 0 && spawnSync("bun", ["--version"]).status === 0 ? " and Bun" : ""}, importing only Node built-ins`)
