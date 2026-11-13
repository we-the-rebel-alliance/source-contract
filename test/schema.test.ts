import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { MAX_BYTES_DEFAULT, MAX_BYTES_LIMIT, SOURCES_SCHEMA } from "../src/schema.ts"

/** An override of `undefined` deletes the key, so "must have" cases are real absences. */
const strip = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))

const eventItem = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  strip({
    id: "gws.gmail",
    kind: "events",
    reads: "message",
    tool: "events_list",
    input: { source: "gmail" },
    accounts: { named: true },
    permission: { events: "gws.events_list", operations: ["gmail.users.messages.list", "gmail.users.messages.get"] },
    cost: { class: "free" },
    ...over,
  })

const snapshotItem = (over: Record<string, unknown> = {}): Record<string, unknown> =>
  strip({
    id: "gws.calendar.today",
    kind: "snapshot",
    tool: "calendar_today",
    output: "agenda",
    accounts: { named: true },
    permission: { tool: "gws.calendar_today", operations: ["calendar.events.list"] },
    cost: { class: "free" },
    ...over,
  })

const declaration = (...items: Record<string, unknown>[]): Record<string, unknown> => ({ contractVersion: 1, items })
const problemsOf = (sources: unknown): readonly string[] => {
  const checked = SOURCES_SCHEMA.check(sources)
  return checked.ok ? [] : checked.problems
}

describe("the sources schema", () => {
  test("accepts an events item and a snapshot item", () => {
    assert.deepEqual(problemsOf(declaration(eventItem(), snapshotItem())), [])
  })

  test("the generated JSON Schema still expresses the rules zod writes", () => {
    const generated = SOURCES_SCHEMA.jsonSchema() as Record<string, any>
    assert.equal(generated["$schema"], "https://json-schema.org/draft/2020-12/schema")
    assert.equal(generated["additionalProperties"], false)
    assert.equal(generated["properties"]["contractVersion"]["const"], 1)
    const branches = generated["properties"]["items"]["items"]["oneOf"] as Record<string, any>[]
    assert.equal(branches.length, 2)
    const events = branches.find((branch) => branch["properties"]["kind"]["const"] === "events")
    const snapshot = branches.find((branch) => branch["properties"]["kind"]["const"] === "snapshot")
    assert.ok(events !== undefined && snapshot !== undefined)
    // An events item has no output, no maxAgeSec and no params: a property whose schema nothing matches.
    assert.deepEqual(events["properties"]["output"], { not: {} })
    assert.deepEqual(events["properties"]["maxAgeSec"], { not: {} })
    assert.deepEqual(events["properties"]["permission"]["properties"]["tool"], { not: {} })
    // A snapshot has no reads and no details.
    assert.deepEqual(snapshot["properties"]["reads"], { not: {} })
    assert.deepEqual(snapshot["properties"]["details"], { not: {} })
    assert.deepEqual(snapshot["properties"]["permission"]["properties"]["events"], { not: {} })
    assert.deepEqual(events["required"].includes("reads"), true)
    assert.deepEqual(snapshot["required"].includes("output"), true)
  })

  test("the contract version is exactly 1", () => {
    assert.ok(problemsOf({ contractVersion: 2, items: [eventItem()] }).some((problem) => /must be 1|Invalid input/.test(problem)))
    assert.ok(problemsOf({ contractVersion: "1", items: [eventItem()] }).some((problem) => /must be 1|Invalid input/.test(problem)))
  })

  test("an unknown key is refused at the top and on an item", () => {
    assert.ok(problemsOf({ contractVersion: 1, items: [eventItem()], extra: true }).length > 0)
    assert.ok(problemsOf(declaration(eventItem({ title: "Gmail" }))).some((problem) => /title/.test(problem)))
  })

  test("an item id is a dotted source id", () => {
    for (const id of ["gmail", "Gmail.mail", "gws..gmail", "gws.gmail.", "1gws.gmail"]) {
      assert.ok(problemsOf(declaration(eventItem({ id }))).length > 0, `${id} must be refused`)
    }
  })

  test("an events item reads something, and a snapshot carries no reads and no details", () => {
    assert.ok(problemsOf(declaration(eventItem({ reads: undefined }))).some((problem) => /reads/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ output: "agenda" }))).some((problem) => /output/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ maxAgeSec: 900 }))).some((problem) => /maxAgeSec/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ params: {} }))).some((problem) => /params/.test(problem)))
    assert.ok(problemsOf(declaration(snapshotItem({ reads: "message" }))).some((problem) => /reads/.test(problem)))
    assert.ok(problemsOf(declaration(snapshotItem({ details: [] }))).some((problem) => /details/.test(problem)))
  })

  test("a snapshot output names a schema in the registry", () => {
    assert.ok(problemsOf(declaration(snapshotItem({ output: undefined }))).some((problem) => /output/.test(problem)))
    assert.ok(problemsOf(declaration(snapshotItem({ output: "Spreadsheet" }))).some((problem) => /output|lowercase name/.test(problem)))
    assert.deepEqual(problemsOf(declaration(snapshotItem({ output: "table" }))), [])
  })

  test("permission operations are required, and the action matches the kind", () => {
    assert.ok(problemsOf(declaration(eventItem({ permission: { events: "gws.events_list" } }))).some((problem) => /operations/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ permission: { operations: [] } }))).some((problem) => /operations|at least/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ permission: { operations: ["gmail.users.messages.list"] } }))).some((problem) => /events/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ permission: { events: "gws.events_list", tool: "gws.read", operations: ["a.b.c.get"] } }))).some((problem) => /tool/.test(problem)))
    assert.ok(problemsOf(declaration(snapshotItem({ permission: { operations: ["calendar.events.list"] } }))).some((problem) => /tool/.test(problem)))
    assert.ok(problemsOf(declaration(snapshotItem({ permission: { events: "gws.events_list", operations: ["calendar.events.list"] } }))).some((problem) => /events/.test(problem)))
  })

  test("an action is dotted or a namespaced tool action", () => {
    assert.ok(problemsOf(declaration(eventItem({ permission: { events: "eventslist", operations: ["a.b.c.get"] } }))).some((problem) => /action|match/.test(problem)))
    assert.deepEqual(problemsOf(declaration(eventItem({ permission: { events: "slack_events_list", operations: ["a.b.c.get"] } }))), [])
  })

  test("cost states a class, and a billed source states its units and probe cost", () => {
    assert.ok(problemsOf(declaration(eventItem({ cost: { class: "expensive" } }))).some((problem) => /free, metered or billed|one of/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ cost: { class: "billed" } }))).some((problem) => /units/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ cost: { class: "billed", units: [{ per: "post", usd: 0.005 }] } }))).some((problem) => /probe/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ cost: { class: "free", units: [{ per: "post", usd: 0.005 }] } }))).some((problem) => /free/.test(problem)))
    assert.deepEqual(problemsOf(declaration(eventItem({ cost: { class: "billed", units: [{ per: "post", usd: 0.005 }], probe: { per: "call", usd: 0.01 } } }))), [])
    assert.ok(problemsOf(declaration(eventItem({ cost: { class: "metered", probe: { per: "call", usd: 0.01 } } }))).some((problem) => /units/.test(problem)))
  })

  test("maxBytes defaults to 64 KB and never exceeds 1 MB", () => {
    assert.equal(MAX_BYTES_DEFAULT, 65536)
    assert.equal(MAX_BYTES_LIMIT, 1048576)
    assert.ok(problemsOf(declaration(eventItem({ maxBytes: MAX_BYTES_LIMIT + 1 }))).length > 0)
    assert.deepEqual(problemsOf(declaration(eventItem({ maxBytes: 1 }))), [])
    assert.deepEqual(problemsOf(declaration(eventItem({ maxBytes: MAX_BYTES_LIMIT }))), [])
  })

  test("details carry an id, a tool and event field names only", () => {
    const withDetails = (details: unknown): readonly string[] => problemsOf(declaration(eventItem({ details })))
    assert.deepEqual(withDetails([{ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }]), [])
    assert.ok(withDetails([{ id: "slack.workspace.thread", tool: "slack_read_thread", from: [] }]).length > 0)
    assert.ok(withDetails([{ id: "slack.workspace.thread", tool: "slack_read_thread" }]).some((problem) => /from/.test(problem)))
    for (const field of ["title", "text", "body", "message_ts"]) {
      assert.ok(withDetails([{ id: "slack.workspace.thread", tool: "slack_read_thread", from: [field] }]).length > 0, `${field} must be refused`)
    }
  })

  test("scope names its keys and the sentence a person confirms", () => {
    const withScope = (scope: unknown): readonly string[] => problemsOf(declaration(eventItem({ scope })))
    assert.deepEqual(withScope({ keys: ["channels", "labels"], describe: "Which conversations" }), [])
    assert.deepEqual(withScope({ keys: [], describe: "Nothing to choose" }), [])
    assert.ok(withScope({ keys: ["Channels"], describe: "Which" }).length > 0)
    assert.ok(withScope({ keys: ["channels"] }).some((problem) => /describe/.test(problem)))
    assert.ok(withScope({ keys: ["channels"], describe: "Which", extra: true }).length > 0)
    assert.deepEqual(withScope({ keys: ["channels"], describe: "Which", suggest: { tool: "slack_list_user_channels", operations: ["slack_list_user_channels"] } }), [])
    assert.ok(withScope({ keys: ["channels"], describe: "Which", suggest: "slack_list_user_channels" }).length > 0)
    assert.ok(withScope({ keys: ["channels"], describe: "Which", suggest: { tool: "List Channels", operations: ["slack_list_user_channels"] } }).length > 0)
  })

  test("urlHosts is a list of host patterns", () => {
    assert.deepEqual(problemsOf(declaration(eventItem({ urlHosts: ["slack.com", "*.slack-edge.com"] }))), [])
    assert.ok(problemsOf(declaration(eventItem({ urlHosts: "slack.com" }))).some((problem) => /array/.test(problem)))
    assert.ok(problemsOf(declaration(eventItem({ urlHosts: ["https://slack.com/"] }))).length > 0)
    assert.ok(problemsOf(declaration(eventItem({ urlHosts: ["a".repeat(300)] }))).some((problem) => /253/.test(problem)))
  })

  test("accounts, cadence, retention and params keep their shapes", () => {
    assert.deepEqual(problemsOf(declaration(eventItem({ accounts: undefined }))), [])
    assert.ok(problemsOf(declaration(eventItem({ accounts: { named: "yes" } }))).length > 0)
    assert.deepEqual(problemsOf(declaration(eventItem({ cadence: { providerMinMinutes: 15 }, retentionDays: 30 }))), [])
    assert.ok(problemsOf(declaration(eventItem({ cadence: { providerMinMinutes: 0 } }))).length > 0)
    assert.ok(problemsOf(declaration(eventItem({ cadence: { everyMinutes: 30 } }))).length > 0)
    assert.ok(problemsOf(declaration(eventItem({ params: "x" }))).length > 0)
    assert.deepEqual(problemsOf(declaration(snapshotItem({ maxAgeSec: 900, params: { window: { relative: true } } }))), [])
  })
})
