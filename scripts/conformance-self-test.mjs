// The conformance kit run on the package's own examples, from dist/ as it ships.
//
//   node scripts/conformance-self-test.mjs
//
// Each directory under examples/ is an installed plugin as a consumer finds it on disk: a package.json with a top-level
// `sources` key, and optionally a `fixtures/` directory. The kit must accept every example.
//
// Each example is read as a consumer reads it: `readInstalledDescriptor` from dist/, from disk. When the kit lands
// (Memory's `schema` and `conformance` PR, app#2346 comment 6853236031), its checks run here too.
import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const examples = join(root, "examples")
const { readInstalledDescriptor } = await import(pathToFileURL(join(root, "dist", "descriptor.js")).href)
const problems = []
let count = 0

for (const name of existsSync(examples) ? readdirSync(examples).sort() : []) {
  const file = join(examples, name, "package.json")
  if (!existsSync(file)) continue
  count++
  const installed = readInstalledDescriptor(join(examples, name))
  if (!installed.ok) problems.push(...installed.problems.map((problem) => `examples/${name}: ${problem}`))
  else console.log(`examples/${name}: ${installed.value.sources.items.map((source) => source.id).join(", ")} (${installed.value.hash})`)
}

if (problems.length > 0) {
  console.error(`the conformance self-test failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
console.log(`conformance self-test: ${count} example${count === 1 ? "" : "s"} checked`)
