// Makes a Release's files in release/, from a dist/ that `npm run build` made and CI checked.
//
//   node scripts/release.mjs v0.1.0     (the release workflow, on a v* tag)
//   node scripts/release.mjs --dry-run  (CI: the same files for the version in package.json, without a tag)
//
// The files:
// - source-contract-<version>.tgz: the package as `npm pack` makes it (dist/, LICENSE, README.md);
// - source-contract-conformance-<version>.mjs: the conformance kit as one ES module with nothing to install, so a
//   plugin's CI can run it from the Release;
// - source-contract-schemas-<version>.json: every JSON Schema the package publishes, in one file;
// - SHA256SUMS: the SHA-256 of each, as `sha256sum -c` reads it.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "release")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const index = await import(pathToFileURL(join(root, "dist", "index.js")).href)
const dryRun = process.argv.includes("--dry-run")
const tag = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
const problems = []

if (!dryRun && tag !== `v${pkg.version}`) problems.push(`the tag is ${tag ?? "missing"}, and package.json says version ${pkg.version}: tag v${pkg.version}`)
if (!existsSync(join(root, "dist", "index.js"))) problems.push("dist/ is missing: run npm run build")
const kit = join(root, "src", "conformance.ts")
if (!existsSync(kit)) {
  const missing = "src/conformance.ts is missing, so there is no conformance kit to attach"
  if (dryRun) console.warn(`release (dry run): ${missing}`)
  else problems.push(missing)
}
if (problems.length > 0) {
  console.error(`no release:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const base = "source-contract"

// The package, as npm packs it.
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", out], { cwd: root, encoding: "utf8" }))[0]
const tarball = `${base}-${pkg.version}.tgz`
execFileSync("mv", [join(out, packed.filename), join(out, tarball)])

// The conformance kit, one file.
if (existsSync(kit)) {
  await build({
    entryPoints: [kit],
    outfile: join(out, `${base}-conformance-${pkg.version}.mjs`),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    legalComments: "none",
    logLevel: "warning",
    banner: { js: `// ${pkg.name} ${pkg.version}: the conformance kit. Bundles zod (MIT); see THIRD-PARTY-NOTICES.md in the package.` },
  })
}

// Every schema, one file.
const schemaDir = join(root, "dist", "schemas")
const schemas = Object.fromEntries(
  (existsSync(schemaDir) ? readdirSync(schemaDir) : [])
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => [file.slice(0, -".json".length), JSON.parse(readFileSync(join(schemaDir, file), "utf8"))]),
)
writeFileSync(
  join(out, `${base}-schemas-${pkg.version}.json`),
  `${JSON.stringify({ package: pkg.name, version: pkg.version, contractVersion: index.CONTRACT_VERSION, schemas }, null, 2)}\n`,
)

// The sums, last.
const sums = readdirSync(out)
  .sort()
  .map((file) => `${createHash("sha256").update(readFileSync(join(out, file))).digest("hex")}  ${file}`)
writeFileSync(join(out, "SHA256SUMS"), `${sums.join("\n")}\n`)
console.log(`release ${dryRun ? "(dry run) " : ""}${pkg.version}:\n${sums.join("\n")}`)
