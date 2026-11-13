// The conformance kit run on the package's own examples, from dist/ as it ships.
//
//   node scripts/conformance-self-test.mjs
//
// Each directory under examples/ is an installed plugin as a consumer finds it on disk: a package.json with a top-level
// `sources` key, and a fixtures/conformance.json that records what the plugin answers. The schema and the kit must
// accept every example, and every declared source must be exercised.
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadExamples, runExamples } from "./examples.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const schema = await import(pathToFileURL(join(root, "dist", "schema.js")).href)
const conformance = await import(pathToFileURL(join(root, "dist", "conformance.js")).href)

const examples = loadExamples(root)
if (examples.length === 0) {
  console.error("the conformance self-test found no examples: add one under examples/")
  process.exit(1)
}
const results = await runExamples({ root, schema, conformance })
const problems = results.flatMap((result) => result.problems.map((problem) => `examples/${result.name}: ${problem}`))
const reports = results.flatMap((result) => result.reports)

if (problems.length > 0) {
  console.error(`the conformance self-test failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
const checks = reports.reduce((total, report) => total + report.checks.filter((check) => check.ran).length, 0)
console.log(`conformance self-test: ${results.length} examples, ${reports.length} sources, ${checks} checks, every example accepted`)
