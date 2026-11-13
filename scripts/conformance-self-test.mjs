// The conformance kit run on the package's own examples, from dist/ as it ships.
//
//   node scripts/conformance-self-test.mjs
//
// Each directory under examples/ is an installed plugin as a consumer finds it on disk: a package.json with a top-level
// `sources` key, and optionally a `fixtures/` directory. The kit must accept every example.
//
// Until the kit lands (Memory's `schema` and `conformance` PR, app#2346 comment 6853236031) this checks only that each
// example's package.json is JSON with a `sources` key; each module adds its check here as it lands.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const examples = join(root, "examples")
const problems = []
let count = 0

for (const name of existsSync(examples) ? readdirSync(examples).sort() : []) {
  const file = join(examples, name, "package.json")
  if (!existsSync(file)) continue
  count++
  let pkg
  try {
    pkg = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    problems.push(`examples/${name}/package.json is not JSON: ${error.message}`)
    continue
  }
  if (typeof pkg.sources !== "object" || pkg.sources === null) problems.push(`examples/${name}/package.json has no top-level "sources" key`)
}

if (problems.length > 0) {
  console.error(`the conformance self-test failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
console.log(`conformance self-test: ${count} example${count === 1 ? "" : "s"} checked`)
