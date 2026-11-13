// Extension names (opencode-mem#58): `x-<namespace>/<name>` for an event kind, a source's reads and a snapshot's
// output, with an inline `outputSchema` for an `x-` output. Both directions, in a table.
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { SOURCES_SCHEMA } from "../src/schema.ts"
import { eventHash } from "../src/events.ts"
import { declarationProblems, pageProblems, sourceConformance, type ConformanceCalls } from "../src/conformance.ts"
import { checkOutput, isOutputName } from "../src/registry.ts"
import { pickProblemsForOutput } from "../src/pick.ts"
import { checkSources } from "../src/descriptor.ts"

const PLUGIN = "@joe-broadhead/opencode-mem"
const ACCOUNT = "mem@example.test"
const ISO = "2026-11-13T09:00:00.000Z"

const receiptSchema = {
  type: "object",
  required: ["id", "total"],
  properties: { id: { type: "string" }, total: { type: "number" }, currency: { type: "string" } },
  additionalProperties: false,
} as const

const receipt = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "mem.receipts",
  kind: "snapshot",
  tool: "snapshot_read",
  output: "x-mem/receipt",
  outputSchema: receiptSchema,
  accounts: { named: false },
  permission: { tool: "mem.snapshot_read", operations: ["mem.receipts.list"] },
  cost: { class: "free" },
  ...over,
})

const memory = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "mem.notes",
  kind: "events",
  reads: "x-mem/suggestion",
  tool: "events_list",
  input: { source: "mem" },
  accounts: { named: false },
  permission: { events: "mem.events_list", operations: ["mem.notes.list"] },
  cost: { class: "free" },
  ...over,
})

const declarationOf = (item: Record<string, unknown>): { contractVersion: 1; items: Record<string, unknown>[] } => ({ contractVersion: 1, items: [item] })
const schemaProblems = (sources: unknown): readonly string[] => {
  const checked = SOURCES_SCHEMA.check(sources)
  return checked.ok ? [] : checked.problems
}

describe("an extension name in the schema", () => {
  const cases: readonly { readonly name: string; readonly item: Record<string, unknown>; readonly ok: boolean }[] = [
    { name: "a core reads", item: memory({ reads: "message" }), ok: true },
    { name: "an x- reads", item: memory({ reads: "x-mem/suggestion" }), ok: true },
    { name: "an x- reads with no name", item: memory({ reads: "x-mem/" }), ok: false },
    { name: "a dotted reads", item: memory({ reads: "x.mem" }), ok: false },
    { name: "a registry output", item: receipt({ output: "agenda", outputSchema: undefined }), ok: true },
    { name: "an x- output with its schema", item: receipt(), ok: true },
    { name: "an x- output with no schema", item: receipt({ outputSchema: undefined }), ok: false },
    { name: "a registry output with a schema", item: receipt({ output: "agenda" }), ok: false },
    { name: "an x- output with no name", item: receipt({ output: "x-mem/" }), ok: false },
  ]

  test("reads and output take a core name or x-<namespace>/<name>, and only an x- output has a schema", () => {
    for (const entry of cases) {
      const problems = schemaProblems(declarationOf(entry.item))
      assert.equal(problems.length === 0, entry.ok, `${entry.name}: ${problems.join("; ")}`)
    }
  })
})

describe("an extension name's namespace is the source's", () => {
  const cases: readonly { readonly name: string; readonly item: Record<string, unknown>; readonly ok: boolean }[] = [
    { name: "reads x-mem on mem.notes", item: memory(), ok: true },
    { name: "reads x-other on mem.notes", item: memory({ reads: "x-other/suggestion" }), ok: false },
    { name: "output x-mem on mem.receipts", item: receipt(), ok: true },
    { name: "output x-other on mem.receipts", item: receipt({ output: "x-other/receipt" }), ok: false },
    { name: "reads x-mem on gws.gmail", item: memory({ id: "gws.gmail", permission: { events: "gws.events_list", operations: ["gmail.users.messages.list"] } }), ok: false },
  ]

  test("a mismatch is refused, and the schema itself cannot see it", () => {
    for (const entry of cases) {
      const problems = declarationProblems(declarationOf(entry.item))
      assert.equal(problems.length === 0, entry.ok, `${entry.name}: ${problems.join("; ")}`)
      if (!entry.ok) assert.deepEqual(schemaProblems(declarationOf(entry.item)), [], `${entry.name}: the schema carries only the shape`)
    }
  })

  test("an output schema over 32 KB is refused", () => {
    const huge = { type: "object", properties: Object.fromEntries(Array.from({ length: 900 }, (_, index) => [`k${index}`, { type: "string", description: "x".repeat(40) }])) }
    assert.ok(declarationProblems(declarationOf(receipt({ outputSchema: huge }))).some((problem) => /32768/.test(problem)))
  })
})

describe("an x- output is checked against its inline schema", () => {
  test("checkOutput and pick use the inline schema for an x- name", () => {
    assert.equal(checkOutput("x-mem/receipt", { id: "r1", total: 3 }, receiptSchema).ok, true)
    const bad = checkOutput("x-mem/receipt", { id: "r1" }, receiptSchema)
    assert.equal(bad.ok, false)
    if (!bad.ok) assert.ok(bad.problems.some((problem) => /total/.test(problem)), bad.problems.join("; "))
    assert.deepEqual(pickProblemsForOutput("x-mem/receipt", ["id", "total"], receiptSchema), [])
    assert.ok(pickProblemsForOutput("x-mem/receipt", ["nope"], receiptSchema).length > 0)
    // A registry name still uses the registry, and is still recognised.
    assert.equal(isOutputName("agenda"), true)
    assert.equal(checkOutput("agenda", {}).ok, false)
    const noSchema = checkOutput("x-mem/receipt", { id: "r1", total: 1 })
    assert.equal(noSchema.ok, false)
  })

  test("the descriptor accepts the declaration, and refuses a bad one", () => {
    assert.equal(checkSources(declarationOf(receipt())).ok, true)
    assert.equal(checkSources(declarationOf(memory())).ok, true)
    assert.equal(checkSources(declarationOf(receipt({ outputSchema: undefined }))).ok, false)
  })
})

describe("conformance with an extension output", () => {
  const run = (data: unknown) =>
    sourceConformance({
      plugin: PLUGIN,
      source: (() => {
        const checked = SOURCES_SCHEMA.check(declarationOf(receipt()))
        if (!checked.ok) throw new Error(checked.problems.join("; "))
        return checked.value.items[0]!
      })(),
      tools: [{ id: "snapshot_read", readOnly: true }],
      snapshotCases: [{ window: "today" }],
      calls: {
        probe: async (_input, context) => {
          await context.permission.assert({ action: "mem.snapshot_read" })
          return { account: ACCOUNT, owner: { id: "mem:1", label: "Memory" } }
        },
        snapshot: async (_input, context) => {
          await context.permission.assert({ action: "mem.snapshot_read" })
          await context.permission.assert({ action: "mem.read", resources: [`${ACCOUNT}:mem.receipts.list`] })
          return { data, asOf: ISO }
        },
      },
    })

  test("a snapshot's data validates against the inline schema", async () => {
    const good = await run({ id: "r1", total: 3 })
    assert.deepEqual(good.problems, [], good.problems.join("; "))
    assert.equal(good.checks.find((check) => check.name === "output-schema")?.ran, true)
    const bad = await run({ id: "r1" })
    assert.ok(bad.problems.some((problem) => /data at total/.test(problem)), bad.problems.join("; "))
  })

  test("a page's x- kind must be in the source's namespace", () => {
    const source = (() => {
      const checked = SOURCES_SCHEMA.check(declarationOf(memory()))
      if (!checked.ok) throw new Error(checked.problems.join("; "))
      return checked.value.items[0]!
    })()
    const options = { source, plugin: PLUGIN, input: {} }
    const page = (kind: string): Record<string, unknown> => ({
      source: "mem",
      plugin: PLUGIN,
      account: ACCOUNT,
      owner: { id: "mem:1", label: "Memory" },
      asOf: ISO,
      trust: "untrusted",
      events: [{ ...(() => { const rest = { source: "mem", account: ACCOUNT, external_id: "n1", kind, occurred_at: ISO, title: "t", text: "", url: null, thread: null, actors: [], labels: [] }; return { ...rest, hash: eventHash(rest as never) } })() }],
      cursor: "c1",
      more: false,
      refused: [],
      failed: [],
    })
    assert.deepEqual(pageProblems(page("x-mem/suggestion"), options), [])
    assert.ok(pageProblems(page("x-other/suggestion"), options).some((problem) => /namespace/.test(problem)))
  })
})

// github's `events_list` asserts `github_api` on a method and path (`GET /user`), with no account prefix, which the
// `<account>:<operation>` convention cannot express. The narrowest form the app can read is the grants verbatim.
describe("a source whose grants are stated verbatim", () => {
  const github = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "github.activity",
    kind: "events",
    reads: "message",
    tool: "events_list",
    input: { source: "github" },
    accounts: { named: true },
    permission: {
      events: "github.events_list",
      rules: ["GET /user", "GET /search/issues", "GET /notifications"].map((resource) => ({ action: "github_api", resource })),
    },
    cost: { class: "metered", units: [{ per: "request", usd: 0 }] },
    ...over,
  })
  const rules = ["GET /user", "GET /search/issues", "GET /notifications"]

  test("the table: rules, operations, or neither, and never both", () => {
    const cases: readonly { readonly name: string; readonly item: Record<string, unknown>; readonly ok: boolean }[] = [
      { name: "rules verbatim", item: github(), ok: true },
      { name: "operations", item: github({ permission: { events: "github.events_list", operations: ["mem.notes.list"] } }), ok: true },
      { name: "both", item: github({ permission: { events: "github.events_list", operations: ["mem.notes.list"], rules: [{ action: "github_api", resource: "GET /user" }] } }), ok: false },
      { name: "neither", item: github({ permission: { events: "github.events_list" } }), ok: false },
      { name: "a rule with no action", item: github({ permission: { events: "github.events_list", rules: [{ resource: "GET /user" }] } }), ok: false },
    ]
    for (const entry of cases) {
      const problems = schemaProblems(declarationOf(entry.item))
      assert.equal(problems.length === 0, entry.ok, `${entry.name}: ${problems.join("; ")}`)
    }
    assert.deepEqual(declarationProblems(declarationOf(github())), [])
  })

  test("the kit proves declared equals asserted for a rule", async () => {
    const source = (() => {
      const checked = SOURCES_SCHEMA.check(declarationOf(github()))
      if (!checked.ok) throw new Error(checked.problems.join("; "))
      return checked.value.items[0]!
    })()
    const run = (asserted: readonly string[]) =>
      sourceConformance({
        plugin: "@joe-broadhead/opencode-github",
        source,
        tools: [{ id: "events_list", readOnly: true }],
        sources: { rpc: "github.activity.tools", probe: { action: "github.probe" } },
        describe: { id: "github.activity.tools" },
        cases: [{ name: "a page", input: {} }],
        calls: {
          list: async (_input, context) => {
            await context.permission.assert({ action: "github.events_list" })
            for (const resource of asserted) await context.permission.assert({ action: "github_api", resources: [resource] })
            return {
              source: "github",
              plugin: "@joe-broadhead/opencode-github",
              account: "octo@example.test",
              owner: { id: "github:octocat", label: "Octocat" },
              asOf: ISO,
              trust: "untrusted",
              events: [],
              cursor: "c1",
              more: false,
              refused: [{ external_id: "n2", reason: "secret" }],
              failed: [],
            }
          },
          probe: async (_input, context) => {
            await context.permission.assert({ action: "github.probe" })
            return { account: "octo@example.test", owner: { id: "github:octocat", label: "Octocat" } }
          },
        },
      })
    const good = await run(rules)
    assert.deepEqual(good.problems, [], good.problems.join("; "))
    assert.equal(good.checks.find((check) => check.name === "rpc-id")?.ran, true)
    const missing = await run(["GET /user"])
    assert.ok(missing.problems.some((problem) => /github_api on GET \/search\/issues/.test(problem)), missing.problems.join("; "))
  })
})
