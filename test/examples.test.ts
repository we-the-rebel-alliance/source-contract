import assert from "node:assert/strict"
import { dirname, join } from "node:path"
import { describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { loadExamples, runExamples } from "../scripts/examples.ts"
import * as conformance from "../src/conformance.ts"
import * as events from "../src/events.ts"
import * as schema from "../src/schema.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("the examples", () => {
  test("each one declares its sources and records its own answers", () => {
    const examples = loadExamples(root)
    assert.deepEqual(
      examples.map((example) => example.name),
      ["gws-calendar", "gws-gmail", "slack"],
    )
    for (const example of examples) assert.ok(example.fixture !== undefined, `${example.name} records no fixture`)
  })

  test("the schema and the kit accept every example, and every declared source is exercised", async () => {
    const results = await runExamples({ root, schema, conformance, events })
    assert.equal(results.length, 3)
    for (const result of results) assert.deepEqual(result.problems, [], result.name)
    const sources = results.flatMap((result) => result.reports.map((report) => report.source))
    assert.deepEqual(sources.sort(), ["gws.calendar", "gws.calendar.today", "gws.gmail", "slack.workspace"])
  })

  test("every check Memory adds runs on at least one example", async () => {
    const results = await runExamples({ root, schema, conformance, events })
    const ran = new Set(results.flatMap((result) => result.reports.flatMap((report) => report.checks.filter((check) => check.ran).map((check) => check.name))))
    for (const name of ["declaration", "page-result", "failed-holds-cursor", "gap-and-cursor-expired", "refused-is-final", "probe", "details", "suggest", "unused-grants"]) {
      assert.ok(ran.has(name), `${name} did not run on any example`)
    }
  })
})
