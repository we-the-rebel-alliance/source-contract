// The examples under examples/, checked the way a consumer finds them on disk: a package.json with a top-level
// `sources` key, and a fixtures/conformance.json that records what the plugin answers.
//
// `scripts/conformance-self-test.mjs` runs this against dist/ as it ships; `test/examples.test.ts` runs it against
// src/, so a failure names the module rather than the bundle.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Validator } from "../src/internal/checked.ts"
import type { Sources } from "../src/schema.ts"
import type { CaseExpectation, ConformanceReport, SourceConformanceOptions, ToolDeclaration } from "../src/conformance.ts"

/** One example directory, as it sits on disk. */
export interface Example {
  readonly name: string
  readonly sources: unknown
  readonly fixture: Fixture | undefined
}

/** A recorded fixture: what the plugin answered, for the kit to replay. */
export interface Fixture {
  readonly plugin?: string | undefined
  readonly account?: string | undefined
  readonly tools?: readonly ToolDeclaration[] | undefined
  readonly sources?: Readonly<Record<string, RecordedSource>> | undefined
}

/** One source's recorded answers. */
export interface RecordedSource {
  readonly cases?: readonly RecordedCase[] | undefined
  readonly probe?: RecordedCall | undefined
  readonly details?:
    | readonly (RecordedCall & { readonly id: string; readonly scope?: unknown; readonly event?: unknown; readonly expect?: unknown; readonly refuses?: string | undefined })[]
    | undefined
  readonly suggest?: RecordedCall | undefined
  readonly snapshot?: (RecordedCall & { readonly input?: Readonly<Record<string, unknown>> | undefined }) | undefined
  readonly identity?: readonly string[] | undefined
  readonly atomicPages?: { readonly reason: string } | undefined
}

/** One recorded call: its input, the assertions it made, and its answer or its refusal. */
export interface RecordedCase {
  readonly input: Readonly<Record<string, unknown>>
  readonly name?: string | undefined
  readonly expect?: CaseExpectation | undefined
  readonly asserts?: readonly { readonly action: string; readonly resource: string }[] | undefined
  readonly answer?: unknown
  readonly refuses?: string | undefined
  readonly since?: string | undefined
}

/** A recorded call that names no input of its own. */
export interface RecordedCall {
  readonly asserts?: readonly { readonly action: string; readonly resource: string }[] | undefined
  readonly answer?: unknown
}

/** The modules `runExamples` needs: the schema and the kit, from src or from dist. */
export interface ExampleModules {
  readonly root: string
  readonly schema: { readonly SOURCES_SCHEMA: Validator<Sources> }
  readonly conformance: {
    readonly declarationProblems: (sources: unknown, options: { readonly tools: readonly ToolDeclaration[] }) => readonly string[]
    readonly sourceConformance: (options: SourceConformanceOptions) => Promise<ConformanceReport>
  }
  /** The `events` module's page validator: the authority on a recorded page's shape. */
  readonly events: { readonly resultProblems: (result: unknown, limit?: number, maxBytes?: number) => readonly string[] }
}

/** The result for one example: what is wrong with it, and the kit's report per source. */
export interface ExampleResult {
  readonly name: string
  readonly problems: readonly string[]
  readonly reports: readonly ConformanceReport[]
}

/** A JSON value, compared as JSON: key order does not matter, every other difference does. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

const sameJson = (left: unknown, right: unknown): boolean => canonical(left) === canonical(right)

/** Each example directory: its declaration and its recorded cases. */
export function loadExamples(root: string): Example[] {
  const directory = join(root, "examples")
  return (existsSync(directory) ? readdirSync(directory).sort() : []).map((name) => {
    const files = join(directory, name)
    const pkg = JSON.parse(readFileSync(join(files, "package.json"), "utf8")) as { sources: unknown }
    const fixtureFile = join(files, "fixtures", "conformance.json")
    const fixture = existsSync(fixtureFile) ? (JSON.parse(readFileSync(fixtureFile, "utf8")) as Fixture) : undefined
    return { name, sources: pkg.sources, fixture }
  })
}

/** Run the schema and the kit over every example: none may fail, and every declared source must be exercised. */
export async function runExamples({ root, schema, conformance, events }: ExampleModules): Promise<ExampleResult[]> {
  const results: ExampleResult[] = []
  for (const example of loadExamples(root)) {
    const problems: string[] = []
    const reports: ConformanceReport[] = []
    const pkg = JSON.parse(readFileSync(join(root, "examples", example.name, "package.json"), "utf8")) as { name: string; sources: unknown }
    const checked = schema.SOURCES_SCHEMA.check(example.sources)
    if (!checked.ok) problems.push(...checked.problems.map((problem) => `sources: ${problem}`))
    // Every recorded page is a page result of contract 1, so the `events` module is asked first.
    for (const [id, recorded] of Object.entries(example.fixture?.sources ?? {})) {
      const pages = [
        ...(recorded.cases ?? []).filter((entry) => entry.answer !== undefined).map((entry) => ({ what: `${id} ${entry.name ?? "a case"}`, answer: entry.answer })),
        ...(recorded.details ?? []).filter((entry) => entry.answer !== undefined).map((entry) => ({ what: `${id} ${entry.id}`, answer: entry.answer })),
      ]
      for (const page of pages) problems.push(...events.resultProblems(page.answer).map((problem) => `${page.what}: ${problem}`))
    }
    const fixture = example.fixture
    if (fixture === undefined) {
      problems.push("fixtures/conformance.json is missing: the kit must run the example's own answers")
      results.push({ name: example.name, problems, reports })
      continue
    }
    if (fixture.plugin !== undefined && fixture.plugin !== pkg.name) problems.push(`the fixture names the plugin ${fixture.plugin}, and package.json names ${pkg.name}`)
    const tools = fixture.tools ?? []
    problems.push(...conformance.declarationProblems(example.sources, { tools }))
    const sources = checked.ok ? checked.value.items : []
    const declared = new Set(sources.map((source) => source.id))
    for (const id of Object.keys(fixture.sources ?? {})) {
      if (!declared.has(id)) problems.push(`the fixture records ${id}, which the declaration does not name`)
    }
    for (const source of sources) {
      const recorded = fixture.sources?.[source.id]
      if (recorded === undefined) {
        problems.push(`${source.id} is declared and the fixture records no cases for it`)
        continue
      }
      const report = await conformance.sourceConformance({
        plugin: pkg.name,
        source,
        tools,
        ...(fixture.account === undefined ? {} : { account: fixture.account }),
        ...(recorded.identity === undefined ? {} : { identityOperations: recorded.identity }),
        ...(recorded.atomicPages === undefined ? {} : { atomicPages: recorded.atomicPages }),
        ...(recorded.snapshot === undefined ? {} : { snapshotCases: [recorded.snapshot.input ?? {}] }),
        cases: (recorded.cases ?? []).map((entry) => ({
          name: entry.name ?? "a recorded case",
          input: entry.input,
          ...(entry.expect === undefined ? {} : { expect: entry.expect }),
        })),
        detailCases: (recorded.details ?? []).map((detail) => ({
          id: detail.id,
          ...(detail.scope === undefined ? {} : { scope: detail.scope as Readonly<Record<string, readonly string[]>> }),
          ...(detail.event === undefined ? {} : { event: detail.event as Readonly<Record<string, unknown>> }),
          ...(detail.expect === undefined ? {} : { expect: detail.expect as { readonly refuses: string } }),
        })),
        calls: replay(source.id, recorded),
      })
      reports.push(report)
      problems.push(...report.problems.map((problem) => `${source.id}: ${problem}`))
    }
    results.push({ name: example.name, problems, reports })
  }
  return results
}

/** The calls a recorded fixture replays: each input exactly, and each assertion it recorded. */
function replay(sourceId: string, recorded: RecordedSource): SourceConformanceOptions["calls"] {
  const cases = recorded.cases ?? []
  const find = (input: unknown): RecordedCase => {
    const found = cases.find((entry) => sameJson(entry.input, input))
    if (found === undefined) {
      throw new Error(`FIXTURE_MISSING: the fixture of ${sourceId} records no answer for ${JSON.stringify(input)}. Next step: record that call in fixtures/conformance.json.`)
    }
    return found
  }
  const assertAll = async (context: { readonly permission: { assert(input: { action: string; resources: string[] }): Promise<void> } }, asserts: readonly { action: string; resource: string }[] = []): Promise<void> => {
    for (const assertion of asserts) await context.permission.assert({ action: assertion.action, resources: [assertion.resource] })
  }
  const calls: Record<string, unknown> = {
    probe: async (_input: unknown, context: never) => {
      if (recorded.probe === undefined) {
        throw new Error(`FIXTURE_MISSING: the fixture of ${sourceId} records no probe. Next step: record the probe answer in fixtures/conformance.json.`)
      }
      await assertAll(context, recorded.probe.asserts)
      return recorded.probe.answer
    },
  }
  if (cases.length > 0) {
    calls["list"] = async (input: unknown, context: never) => {
      const entry = find(input)
      await assertAll(context, entry.asserts)
      if (entry.refuses !== undefined) throw Object.assign(new Error(entry.refuses), entry.since === undefined ? {} : { since: entry.since })
      return entry.answer
    }
  }
  const details = recorded.details ?? []
  if (details.length > 0) {
    calls["details"] = Object.fromEntries(
      [...new Set(details.map((detail) => detail.id))].map((id) => [
        id,
        async (input: { readonly fields: Readonly<Record<string, unknown>> }, context: never) => {
          const entry = details.find(
            (detail) =>
              detail.id === id &&
              Object.entries((detail.event ?? {}) as Record<string, unknown>).every(([field, value]) => sameJson(input.fields[field], value)),
          )
          if (entry === undefined) {
            throw new Error(`FIXTURE_MISSING: the fixture of ${sourceId} records no detail answer for ${JSON.stringify(input.fields)}. Next step: record that call in fixtures/conformance.json.`)
          }
          await assertAll(context, entry.asserts)
          if (entry.refuses !== undefined) throw new Error(entry.refuses)
          return entry.answer
        },
      ]),
    )
  }
  if (recorded.snapshot !== undefined) {
    const snapshot = recorded.snapshot
    calls["snapshot"] = async (_input: unknown, context: never) => {
      await assertAll(context, snapshot.asserts)
      return snapshot.answer
    }
  }
  if (recorded.suggest !== undefined) {
    const suggest = recorded.suggest
    calls["suggest"] = async (_input: unknown, context: never) => {
      await assertAll(context, suggest.asserts)
      return suggest.answer
    }
  }
  return calls as unknown as SourceConformanceOptions["calls"]
}
