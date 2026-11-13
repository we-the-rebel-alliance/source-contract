// Builds dist/: one bundled ES module per entry in package.json `exports`, the type declarations, the JSON Schemas and
// the notices of what is bundled. Nothing in dist/ imports anything but Node built-ins (`npm run check:dist`).
//
//   node scripts/build.mjs
//
// Every "./<name>" export is built from src/<name>.ts, and "." from src/index.ts. dist/ is committed, so a tag installs
// with no build; CI fails when it is not what this script makes.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"
import { entryPoints, pruneDeclarations } from "./entries.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

const entries = entryPoints(pkg, root)
const result = await build({
  entryPoints: entries.map((entry) => ({ in: entry.source, out: entry.name })),
  outdir: dist,
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node22",
  chunkNames: "chunks/[name]-[hash]",
  legalComments: "none",
  metafile: true,
  logLevel: "warning",
  banner: { js: `// ${pkg.name} ${pkg.version}. Built by scripts/build.mjs; do not edit.` },
})

// The notices of every bundled package, from the files esbuild read.
const bundled = new Set()
for (const input of Object.keys(result.metafile.inputs)) {
  const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input)
  if (match) bundled.add(match[1])
}
const notices = [...bundled].sort().map((name) => {
  const dir = join(root, "node_modules", name)
  const own = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  const file = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"].map((candidate) => join(dir, candidate)).find(existsSync)
  if (!file) throw new Error(`build: ${name} is bundled but has no licence file`)
  return `## ${name} ${own.version} (${own.license})\n\n${readFileSync(file, "utf8").trim()}\n`
})
writeFileSync(
  join(dist, "THIRD-PARTY-NOTICES.md"),
  `# Bundled packages\n\ndist/ bundles these packages, so an install needs none of them.\n\n${notices.join("\n")}`,
)

// The type declarations, then only those an export reaches.
execFileSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.build.json")], { stdio: "inherit" })
pruneDeclarations(pkg, dist)

// The JSON Schemas, generated from the zod source of truth.
const { SCHEMAS } = await import(pathToFileURL(join(dist, "schemas.js")).href)
mkdirSync(join(dist, "schemas"), { recursive: true })
for (const schema of SCHEMAS) {
  writeFileSync(join(dist, "schemas", `${schema.name}.json`), `${JSON.stringify(schema.jsonSchema(), null, 2)}\n`)
}

console.log(`built ${entries.length} entries, ${SCHEMAS.length} schemas, bundling ${[...bundled].join(", ") || "nothing"} into ${relative(root, dist)}/`)
