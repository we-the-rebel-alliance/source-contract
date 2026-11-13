// The conformance kit run on the package's own examples, from dist/ as it ships.
//
//   node scripts/conformance-self-test.mjs
//
// Each directory under examples/ is an installed plugin as a consumer finds it on disk: a package.json with a top-level
// `sources` key, and a fixtures/conformance.json that records what the plugin answers. Each example is read twice, on
// purpose: once by the app's `readInstalledDescriptor`, as a consumer reads it and hashes it, and once by the kit.
import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadExamples, runExamples } from "./examples.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const examples = join(root, "examples")
const { readInstalledDescriptor } = await import(pathToFileURL(join(root, "dist", "descriptor.js")).href)
const schema = await import(pathToFileURL(join(root, "dist", "schema.js")).href)
const conformance = await import(pathToFileURL(join(root, "dist", "conformance.js")).href)

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
if (count === 0) {
  console.error("the conformance self-test found no examples: add one under examples/")
  process.exit(1)
}

const results = await runExamples({ root, schema, conformance })
problems.push(...results.flatMap((result) => result.problems.map((problem) => `examples/${result.name}: ${problem}`)))
const reports = results.flatMap((result) => result.reports)

if (problems.length > 0) {
  console.error(`the conformance self-test failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
const checks = reports.reduce((total, report) => total + report.checks.filter((check) => check.ran).length, 0)
console.log(`conformance self-test: ${results.length} examples, ${reports.length} sources, ${checks} checks, every example accepted`)
