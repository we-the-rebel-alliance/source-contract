// The review's cases, one test per finding: every check the reviewer defeated, and every false refusal.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import { SOURCES_SCHEMA } from "../src/schema.ts"
import {
  declarationProblems,
  nameProblem,
  operationProblem,
  sourceConformance,
  urlHostProblem,
  type ConformanceCalls,
  type ToolDeclaration,
} from "../src/conformance.ts"

const PLUGIN = "@joe-broadhead/opencode-slack"
const ACCOUNT = "T0PILOT01"
const ISO = "2026-11-13T09:00:00.000Z"

const problemsOf = (sources: unknown): readonly string[] => {
  const checked = SOURCES_SCHEMA.check(sources)
  return checked.ok ? [] : checked.problems
}
const declarationOf = (item: Record<string, unknown>): { contractVersion: 1; items: Record<string, unknown>[] } => ({ contractVersion: 1, items: [item] })
const sourceOf = (item: Record<string, unknown>): never => {
  const checked = SOURCES_SCHEMA.check(declarationOf(item))
  if (!checked.ok) throw new Error(checked.problems.join("; "))
  return checked.value.items[0] as never
}

// §2.2's three items, verbatim from design comment index 4. The X item has no `accounts`, and each has a `cost`.
const designItems = (): Record<string, unknown>[] => [
  {
    id: "gws.gmail",
    kind: "events",
    reads: "message",
    tool: "events_list",
    input: { source: "gmail" },
    accounts: { named: true },
    scope: { keys: ["label"], describe: "Which labels" },
    details: [{ id: "gws.gmail.message", tool: "read", from: ["external_id"] }],
    permission: { events: "gws.events_list", operations: ["gmail.users.history.list", "gmail.users.messages.list", "gmail.users.messages.get"] },
    private: true,
    cost: { class: "free" },
    maxBytes: 262144,
    retentionDays: 30,
  },
  {
    id: "gws.calendar.today",
    kind: "snapshot",
    tool: "calendar_today",
    output: "agenda",
    params: { window: { relative: true } },
    accounts: { named: true },
    permission: { tool: "gws.calendar_today", operations: ["calendar.events.list"] },
    private: true,
    cost: { class: "free" },
    maxAgeSec: 900,
    maxBytes: 65536,
  },
  {
    id: "x.mentions",
    kind: "events",
    reads: "message",
    tool: "events_list",
    input: { source: "mentions" },
    permission: { events: "x.events_list", operations: ["x.users.mentions"] },
    cost: { class: "billed", units: [{ per: "post", usd: 0.005 }, { per: "author", usd: 0.01 }], probe: { per: "call", usd: 0.01 } },
    cadence: { providerMinMinutes: 15 },
  },
]

describe("the required fields of §2.2", () => {
  test("the design's three items validate verbatim, and accounts is optional", () => {
    assert.deepEqual(problemsOf({ contractVersion: 1, items: designItems() }), [])
  })

  test("a source without accounts validates", () => {
    const item = { ...(designItems()[2] as Record<string, unknown>) }
    assert.deepEqual(problemsOf(declarationOf(item)), [])
  })
})

describe("the cost rules are in the generated JSON Schema", () => {
  const costBranches = (): Record<string, any>[] => {
    const generated = SOURCES_SCHEMA.jsonSchema() as Record<string, any>
    const branches = generated["properties"]["items"]["items"]["oneOf"] as Record<string, any>[]
    const events = branches.find((branch) => branch["properties"]["kind"]["const"] === "events")
    if (events === undefined) throw new Error("the generated schema has no events branch")
    return events["properties"]["cost"]["oneOf"] as Record<string, any>[]
  }

  test("cost is a union of free, metered and billed, each with what it requires", () => {
    const branches = costBranches()
    assert.equal(branches.length, 3)
    const byClass = Object.fromEntries(branches.map((branch) => [branch["properties"]["class"]["const"], branch]))
    assert.deepEqual(byClass["free"]["properties"]["units"], { not: {} })
    assert.deepEqual(byClass["free"]["properties"]["probe"], { not: {} })
    assert.ok(byClass["billed"]["required"].includes("units") && byClass["billed"]["required"].includes("probe"))
    assert.ok(byClass["metered"]["required"].includes("units"))
    assert.equal(byClass["metered"]["required"].includes("probe"), false)
  })

  test("the schema refuses the cost shapes the rule refused", () => {
    assert.ok(problemsOf(declarationOf({ ...(designItems()[2] as Record<string, unknown>), cost: { class: "billed", units: [{ per: "post", usd: 1 }] } })).length > 0)
    assert.ok(problemsOf(declarationOf({ ...(designItems()[2] as Record<string, unknown>), cost: { class: "free", units: [{ per: "post", usd: 1 }] } })).length > 0)
  })
})

describe("the limits §2.2 does not state", () => {
  test("maxBytes shows its default and keeps the 1 MB ceiling", () => {
    const generated = SOURCES_SCHEMA.jsonSchema() as Record<string, any>
    const branches = generated["properties"]["items"]["items"]["oneOf"] as Record<string, any>[]
    const events = branches.find((branch) => branch["properties"]["kind"]["const"] === "events")
    if (events === undefined) throw new Error("the generated schema has no events branch")
    assert.equal(events["properties"]["maxBytes"]["default"], 65536)
    assert.equal(events["properties"]["maxBytes"]["maximum"], 1048576)
    assert.notEqual(events["properties"]["maxBytes"]["minimum"], 1024)
    // A declaration may omit it: the default is an annotation, never a required key.
    assert.equal((events["required"] as string[]).includes("maxBytes"), false)
  })

  test("a page under 1024 bytes is not refused, and maxAgeSec, retentionDays and usd have no ceiling", () => {
    const item = designItems()[0] as Record<string, unknown>
    assert.deepEqual(problemsOf(declarationOf({ ...item, maxBytes: 1 })), [])
    assert.deepEqual(problemsOf(declarationOf({ ...item, retentionDays: 4000 })), [])
    assert.deepEqual(problemsOf(declarationOf({ ...(designItems()[1] as Record<string, unknown>), maxAgeSec: 999999 })), [])
    assert.deepEqual(
      problemsOf(declarationOf({ ...(designItems()[2] as Record<string, unknown>), cost: { class: "billed", units: [{ per: "post", usd: 500 }], probe: { per: "call", usd: 1 } } })),
      [],
    )
  })
})

describe("output names a schema, and the registry is the app's", () => {
  test("any name validates, and the registry's names are not copied here", () => {
    assert.deepEqual(problemsOf(declarationOf({ ...(designItems()[1] as Record<string, unknown>), output: "futureschema" })), [])
    assert.ok(problemsOf(declarationOf({ ...(designItems()[1] as Record<string, unknown>), output: "Not A Name" })).length > 0)
  })
})

describe("names and verbs, tokenised", () => {
  test("a read verb in the name, wherever it sits, is accepted", () => {
    for (const name of ["get_issue", "batchGet", "events_list", "calendar_today", "read", "slack_read_channel", "slack_list_user_channels", "list_deleted_items"]) {
      assert.equal(nameProblem(name), undefined, name)
    }
    for (const operation of ["calendar.events.instances", "drive.files.export", "gmail.users.messages.batchGet", "gmail.users.messages.get", "slack_read_channel", "slack_list_user_channels"]) {
      assert.equal(operationProblem(operation), undefined, operation)
    }
  })

  test("a write verb in the verb position is refused", () => {
    for (const name of ["send_message", "delete_issue", "slash_send_message", "slack_send_message", "messages_send", "post_status"]) {
      assert.match(String(nameProblem(name)), /write verb/, name)
    }
    for (const operation of ["gmail.users.messages.send", "gmail.users.messages.insert", "gmail.users.messages.batchModify", "calendar.events.quickAdd", "gmail.users.messages.emptyTrash", "gmail.users.messages.untrash", "calendar.events.watch", "slack_send_message"]) {
      assert.ok(operationProblem(operation) !== undefined, operation)
    }
  })

  test("a compound is refused", () => {
    for (const name of ["getAndSend", "get_and_send", "readThenDelete", "list_and_delete"]) {
      assert.match(String(nameProblem(name)), /joins two actions/, name)
    }
  })

  test("a write verb in a non-verb position is fine", () => {
    assert.equal(nameProblem("get_issue"), undefined)
    assert.equal(nameProblem("list_deleted_items"), undefined)
  })
})

describe("scope.suggest keeps its own operations out of the running grant", () => {
  const suggested = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "slack.workspace",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: false },
    scope: { keys: ["channels"], describe: "Channels", suggest: { tool: "slack_list_user_channels", operations: ["slack_list_user_channels"] } },
    permission: { events: "slack_events_list", operations: ["slack_read_user_profile", "slack_read_channel"] },
    cost: { class: "free" },
    ...over,
  })
  const tools: ToolDeclaration[] = [
    { id: "events_list", readOnly: true },
    { id: "slack_list_user_channels", readOnly: true },
  ]

  test("a suggest object validates, and its operations are never in the running grant", () => {
    assert.deepEqual(problemsOf(declarationOf(suggested())), [])
    const both = suggested({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_list_user_channels"] } })
    assert.ok(declarationProblems(declarationOf(both), { tools }).some((problem) => /scope.suggest.*operations.*permission\.operations|must not appear/.test(problem)))
  })

  test("suggest must name a declared read-only tool", () => {
    assert.ok(declarationProblems(declarationOf(suggested()), { tools: [{ id: "events_list", readOnly: true }, { id: "slack_list_user_channels", readOnly: false }] }).some((problem) => /readOnly/.test(problem)))
    assert.ok(declarationProblems(declarationOf(suggested()), { tools: [{ id: "events_list", readOnly: true }] }).some((problem) => /does not declare/.test(problem)))
  })
})

describe("urlHosts uses the full Public Suffix List", () => {
  test("private-section and ICANN suffixes are refused", () => {
    for (const host of ["*.blogspot.co.uk", "*.uk.com", "*.ondigitalocean.app", "*.co.uk", "co.uk", "*.github.io", "*.com"]) {
      assert.ok(urlHostProblem(host) !== null, host)
    }
    for (const host of ["files.example.co.uk", "*.example.co.uk", "slack.com", "*.slack.com", "mail.google.com"]) {
      assert.equal(urlHostProblem(host), null, host)
    }
  })
})

describe("a report is incomplete when a check did not run", () => {
  const item = (): Record<string, unknown> => ({
    id: "slack.workspace",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: false },
    permission: { events: "slack_events_list", operations: ["slack_slack_read_channel", "slack_slack_read_user_profile"] },
    cost: { class: "free" },
  })

  test("a source with no cases is incomplete, and not ok", async () => {
    const calls: ConformanceCalls = {
      probe: async (_input, context) => {
        await context.permission.assert({ action: "slack_events_list" })
        await context.permission.assert({ action: "slack_slack_read_user_profile" })
        return { account: ACCOUNT, owner: null }
      },
    }
    const report = await sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }],
      calls,
      identityOperations: ["slack_read_user_profile"],
    })
    assert.equal(report.ok, false)
    assert.equal(report.incomplete, true)
    assert.ok(report.checks.some((check) => check.name === "page-result" && check.ran === false && check.notApplicable === false))
  })

  test("a snapshot's unused grants still run, and a source that asserts only its action is incomplete", async () => {
    const snapshot: Record<string, unknown> = {
      id: "gws.calendar.today",
      kind: "snapshot",
      tool: "calendar_today",
      output: "agenda",
      permission: { tool: "gws.calendar_today", operations: ["calendar.events.list"] },
      cost: { class: "free" },
    }
    const report = await sourceConformance({
      plugin: "@joe-broadhead/opencode-gws",
      source: sourceOf(snapshot),
      tools: [{ id: "calendar_today", readOnly: true }],
      calls: {
        probe: async (_input, context) => {
          await context.permission.assert({ action: "gws.calendar_today" })
          return { account: "sam.rivera@example.com", owner: null }
        },
        snapshot: async (_input, context) => {
          await context.permission.assert({ action: "gws.read", resources: ["sam.rivera@example.com:calendar.events.list"] })
          return { data: {}, asOf: ISO }
        },
      },
      snapshotCases: [{ window: "today" }],
    })
    assert.equal(report.ok, true, report.problems.join("; "))
    assert.equal(report.checks.find((check) => check.name === "unused-grants")?.ran, true)
  })
})

describe("probe may assert only the identity operations", () => {
  const item = (): Record<string, unknown> => ({
    id: "gws.gmail",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: true },
    permission: { events: "gws.events_list", operations: ["gmail.users.getProfile", "gmail.users.messages.list"] },
    cost: { class: "free" },
  })
  const page = (): Record<string, unknown> => ({
    source: "gws.gmail",
    plugin: "@joe-broadhead/opencode-gws",
    account: "sam.rivera@example.com",
    owner: null,
    asOf: ISO,
    trust: "untrusted",
    events: [],
    cursor: "c1",
    more: false,
    refused: [],
    failed: [],
  })

  const run = (probeAction: string, probeResource: string) =>
    sourceConformance({
      plugin: "@joe-broadhead/opencode-gws",
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }],
      identityOperations: ["gmail.users.getProfile"],
      cases: [{ name: "a page", input: { account: "sam.rivera@example.com" } }],
      calls: {
        list: async (_input, context) => {
          await context.permission.assert({ action: "gws.events_list" })
          await context.permission.assert({ action: "gws.read", resources: ["sam.rivera@example.com:gmail.users.messages.list"] })
          return page()
        },
        probe: async (_input, context) => {
          await context.permission.assert({ action: probeAction, resources: [probeResource] })
          return { account: "sam.rivera@example.com", owner: null }
        },
      },
    })

  test("a probe that reads the profile passes, and one that reads messages fails", async () => {
    const good = await run("gws.read", "sam.rivera@example.com:gmail.users.getProfile")
    assert.deepEqual(good.problems, [], good.problems.join("; "))
    const bad = await run("gws.read", "sam.rivera@example.com:gmail.users.messages.list")
    assert.ok(bad.problems.some((problem) => /probe.*messages\.list.*not an identity operation/.test(problem)), bad.problems.join("; "))
  })
})

describe("details must refuse an event outside the confirmed scope", () => {
  const item = (): Record<string, unknown> => ({
    id: "slack.workspace",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: false },
    scope: { keys: ["channels"], describe: "Channels" },
    details: [{ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }],
    permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_read_thread"] },
    cost: { class: "free" },
  })
  const page = (): Record<string, unknown> => ({
    source: "slack.workspace",
    plugin: PLUGIN,
    account: ACCOUNT,
    owner: null,
    asOf: ISO,
    trust: "untrusted",
    events: [],
    cursor: "c1",
    more: false,
    refused: [],
    failed: [],
  })
  const run = (refuseOutside: boolean) =>
    sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }, { id: "slack_read_thread", readOnly: true }],
      identityOperations: ["slack_read_channel"],
      cases: [{ name: "a page", input: {} }],
      detailCases: [
        { id: "slack.workspace.thread", scope: { channels: ["C0PILOT001"] }, event: { thread: "slack-thread:C0PILOT001:1" } },
        { id: "slack.workspace.thread", scope: { channels: ["C0PILOT001"] }, event: { thread: "slack-thread:C0PILOT003:1" }, expect: { refuses: "SCOPE_UNKNOWN" } },
      ],
      calls: {
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page()
        },
        probe: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return { account: ACCOUNT, owner: null }
        },
        details: {
          "slack.workspace.thread": async (input, context) => {
            if (input.fields["thread"] === "slack-thread:C0PILOT003:1") {
              if (refuseOutside) throw new Error("SCOPE_UNKNOWN: that thread is in a channel nobody confirmed. Next step: confirm the channel.")
              return page()
            }
            await context.permission.assert({ action: "slack_slack_read_thread" })
            return page()
          },
        },
      },
    })

  test("the out-of-scope call must be refused, and the in-scope call must succeed", async () => {
    const good = await run(true)
    assert.deepEqual(good.problems, [], good.problems.join("; "))
    const bad = await run(false)
    assert.ok(bad.problems.some((problem) => /outside the confirmed scope.*must be refused/.test(problem)), bad.problems.join("; "))
  })

  test("a detail with no out-of-scope case is incomplete", async () => {
    const report = await sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }, { id: "slack_read_thread", readOnly: true }],
      identityOperations: ["slack_read_channel"],
      cases: [{ name: "a page", input: {} }],
      detailCases: [{ id: "slack.workspace.thread", scope: { channels: ["C0PILOT001"] } }],
      calls: {
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page()
        },
        probe: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return { account: ACCOUNT, owner: null }
        },
        details: { "slack.workspace.thread": async () => page() },
      },
    })
    assert.equal(report.incomplete, true)
    assert.ok(report.problems.some((problem) => /no case outside the confirmed scope/.test(problem)))
  })
})

describe("the three mutations the reviewer killed", () => {
  const item = (): Record<string, unknown> => ({
    id: "slack.workspace",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: false },
    permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_read_user_profile"] },
    cost: { class: "free" },
  })
  const page = (): Record<string, unknown> => ({
    source: "slack.workspace",
    plugin: PLUGIN,
    account: ACCOUNT,
    owner: null,
    asOf: ISO,
    trust: "untrusted",
    events: [],
    cursor: "c1",
    more: false,
    refused: [],
    failed: [],
  })

  test("a probe that answers any content key is refused", async () => {
    const report = await sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }],
      identityOperations: ["slack_read_user_profile"],
      cases: [{ name: "a page", input: {} }],
      calls: {
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page()
        },
        probe: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_user_profile" })
          return { account: ACCOUNT, owner: null, data: { messages: [] } }
        },
      },
    })
    assert.ok(report.problems.some((problem) => /must read no content/.test(problem)))
  })

  test("a suggest tool that is not read-only is refused", () => {
    const suggested = {
      ...item(),
      scope: { keys: ["channels"], describe: "Channels", suggest: { tool: "slack_list_user_channels", operations: [] } },
    }
    assert.ok(declarationProblems(declarationOf(suggested), { tools: [{ id: "events_list", readOnly: true }, { id: "slack_list_user_channels", readOnly: false }] }).some((problem) => /readOnly/.test(problem)))
  })

  test("an expiry answered with the wrong code is refused", async () => {
    const report = await sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(item()),
      tools: [{ id: "events_list", readOnly: true }],
      identityOperations: ["slack_read_user_profile"],
      cases: [{ name: "an expired cursor", input: { cursor: "stale" }, expect: "expired" }],
      calls: {
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          throw new Error("CURSOR_INVALID: that cursor is not ours. Next step: read without a cursor.")
        },
        probe: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_user_profile" })
          return { account: ACCOUNT, owner: null }
        },
      },
    })
    assert.ok(report.problems.some((problem) => /not CURSOR_EXPIRED or a gap/.test(problem)))
  })
})

// The rules the generated JSON Schema cannot carry. The PR body lists exactly these names, and each one proves it is
// conformance-only: the schema accepts the declaration and the kit refuses it.
describe("the conformance-only rules", () => {
  const tools: ToolDeclaration[] = [
    { id: "events_list", readOnly: true },
    { id: "slack_read_thread", readOnly: true },
    { id: "slack_list_user_channels", readOnly: true },
  ]
  const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "slack.workspace",
    kind: "events",
    reads: "message",
    tool: "events_list",
    accounts: { named: false },
    permission: { events: "slack_events_list", operations: ["slack_read_channel"] },
    cost: { class: "free" },
    ...over,
  })
  const cases: readonly { readonly rule: string; readonly item: () => Record<string, unknown> }[] = [
    { rule: "a write verb in a name", item: () => base({ tool: "slack_send_message" }) },
    { rule: "a compound name", item: () => base({ tool: "slack_get_and_send" }) },
    { rule: "an operation's verb is not a read verb", item: () => base({ permission: { events: "slack_events_list", operations: ["gmail.users.messages.insert"] } }) },
    { rule: "an action outside the source's namespace", item: () => base({ permission: { events: "gws.events_list", operations: ["slack_read_channel"] } }) },
    { rule: "a urlHosts pattern too broad to mean anything", item: () => base({ urlHosts: ["*.co.uk"] }) },
    { rule: "a duplicate source id", item: () => base() },
    { rule: "a tool not declared read-only", item: () => base({ tool: "slack_send_message" }) },
    { rule: "a suggest operation also in the running grant", item: () => base({ scope: { keys: ["channels"], describe: "Channels", suggest: { tool: "slack_list_user_channels", operations: ["slack_list_user_channels"] } }, permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_list_user_channels"] } }) },
  ]

  const file = readFileSync(new URL("../test/conformance-only.json", import.meta.url), "utf8")
  const listed = JSON.parse(file) as readonly string[]

  test("each rule is conformance-only, and the published list is exactly these rules", () => {
    assert.deepEqual([...listed].sort(), cases.map((entry) => entry.rule).sort())
    for (const entry of cases) {
      const sources = entry.rule === "a duplicate source id" ? { contractVersion: 1, items: [base(), base()] } : declarationOf(entry.item())
      assert.deepEqual(problemsOf(sources), [], `${entry.rule}: the schema must accept it`)
      assert.ok(declarationProblems(sources, { tools }).length > 0, `${entry.rule}: the kit must refuse it`)
    }
  })
})
