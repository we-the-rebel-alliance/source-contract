import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { SOURCES_SCHEMA, type SourceItem } from "../src/schema.ts"
import {
  CORE_KINDS,
  DETAIL_FIELDS,
  SENTINEL,
  assertConformance,
  assertDeclaration,
  declarationProblems,
  detailInputProblems,
  grantsFor,
  nameProblem,
  operationProblem,
  pageProblems,
  readVerbProblem,
  recordingPermission,
  sourceConformance,
  suggestProblems,
  urlHostProblem,
  type ConformanceCalls,
  type Grant,
  type PageCase,
} from "../src/conformance.ts"

const PLUGIN = "@joe-broadhead/opencode-slack"
const ACCOUNT = "T0PILOT01"
const ISO = "2026-11-13T09:00:00.000Z"

const slackItem = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "slack.workspace",
  kind: "events",
  reads: "message",
  tool: "events_list",
  accounts: { named: false },
  scope: { keys: ["channels"], describe: "Channels and direct messages to read.", suggest: "slack_list_user_channels" },
  details: [{ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }],
  permission: {
    events: "slack_events_list",
    operations: ["slack_read_user_profile", "slack_read_channel", "slack_read_thread", "slack_list_user_channels"],
  },
  cost: { class: "free" },
  private: true,
  ...over,
})

const gwsItem = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "gws.gmail",
  kind: "events",
  reads: "message",
  tool: "events_list",
  accounts: { named: true },
  permission: { events: "gws.events_list", operations: ["gmail.users.getProfile", "gmail.users.messages.get"] },
  cost: { class: "free" },
  ...over,
})

const TOOLS = [
  { id: "events_list", readOnly: true },
  { id: "slack_read_thread", readOnly: true },
  { id: "slack_list_user_channels", readOnly: true },
]

const declarationOf = (item: Record<string, unknown>): { contractVersion: 1; items: Record<string, unknown>[] } => ({
  contractVersion: 1,
  items: [item],
})

const sourceOf = (item: Record<string, unknown>): SourceItem => {
  const checked = SOURCES_SCHEMA.check(declarationOf(item))
  if (!checked.ok) throw new Error(checked.problems.join("; "))
  const first = checked.value.items[0]
  if (first === undefined) throw new Error("the declaration parsed to no item")
  return first
}

const hash = `sha256:${"0".repeat(64)}`

const event = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  external_id: "C0PILOT001:1761993000.000100",
  kind: "message",
  occurred_at: "2026-11-01T12:30:00.000Z",
  title: "Postgres or SQLite for the queue?",
  text: "Postgres or SQLite for the queue?",
  url: "https://pilot.slack.com/archives/C0PILOT001/p1761993000000100",
  thread: "slack-thread:C0PILOT001:1761993000.000100",
  actors: [{ id: "slack:U0PILOTAMA", label: "Ama Mensah" }],
  labels: ["channel", "channel:C0PILOT001"],
  hash,
  ...over,
})

const page = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  source: "slack.workspace",
  plugin: PLUGIN,
  account: ACCOUNT,
  owner: { id: "slack:U0PILOTOWN", label: "Pilot Owner" },
  asOf: ISO,
  trust: "untrusted",
  events: [event()],
  cursor: "c1",
  more: false,
  refused: [],
  failed: [],
  ...over,
})

describe("the page result", () => {
  const options = { source: sourceOf(slackItem()), plugin: PLUGIN, input: {} }

  test("a page that keeps the contract has no problems", () => {
    assert.deepEqual(pageProblems(page(), options), [])
  })

  test("the envelope names the source, the plugin, the account and the trust", () => {
    assert.ok(pageProblems(page({ source: "other" }), options).some((problem) => /names source/.test(problem)))
    assert.ok(pageProblems(page({ plugin: "other" }), options).some((problem) => /names plugin/.test(problem)))
    assert.ok(pageProblems(page({ account: "" }), options).some((problem) => /no account/.test(problem)))
    assert.ok(pageProblems(page({ trust: "trusted" }), options).some((problem) => /untrusted/.test(problem)))
    assert.ok(pageProblems(page({ asOf: "yesterday" }), options).some((problem) => /asOf/.test(problem)))
    assert.deepEqual(pageProblems(page({ owner: null }), options), [])
  })

  test("failed[] holds the cursor back", () => {
    const held = page({ failed: [{ external_id: "C0PILOT001:1", reason: "RATE_LIMITED" }], cursor: "c2" })
    assert.ok(pageProblems(held, { ...options, input: { cursor: "c1" } }).some((problem) => /holds the cursor back/.test(problem)))
    assert.deepEqual(pageProblems({ ...held, cursor: "c1" }, { ...options, input: { cursor: "c1" } }), [])
    // The first page has no cursor to hold, so a failed drop must not answer one.
    assert.ok(pageProblems(held, options).some((problem) => /holds the cursor back/.test(problem)))
  })

  test("refused[] is final", () => {
    const refused = page({ refused: [{ external_id: event()["external_id"], reason: "instruction-shaped text" }] })
    assert.ok(pageProblems(refused, options).some((problem) => /a refusal is final/.test(problem)))
    assert.ok(pageProblems(page({ refused: [{ external_id: "x" }] }), options).some((problem) => /names no reason/.test(problem)))
  })

  test("gap is shaped and runs forwards", () => {
    assert.deepEqual(pageProblems(page({ gap: { reason: "window-truncated", since: ISO } }), options), [])
    assert.ok(pageProblems(page({ gap: { reason: "nope", since: ISO } }), options).some((problem) => /gap.reason/.test(problem)))
    assert.ok(
      pageProblems(page({ gap: { reason: "expired", since: ISO, until: "2026-11-01T00:00:00.000Z" } }), options).some((problem) => /is after/.test(problem)),
    )
  })

  test("a billed source reports its cost", () => {
    const billed = { ...sourceOf(slackItem({ cost: { class: "billed", units: [{ per: "post", usd: 0.005 }], probe: { per: "call", usd: 0.01 } } })) }
    assert.ok(pageProblems(page(), { ...options, source: billed }).some((problem) => /cost is missing/.test(problem)))
    assert.deepEqual(pageProblems(page({ cost: { usd: 0.005 } }), { ...options, source: billed }), [])
  })

  test("an event keeps §2.1's fields", () => {
    assert.ok(CORE_KINDS.includes("file") && CORE_KINDS.includes("task"))
    assert.deepEqual(pageProblems(page({ events: [event({ kind: "x-slack/thread" })] }), options), [])
    assert.ok(pageProblems(page({ events: [event({ kind: "nope" })] }), options).some((problem) => /kind must be/.test(problem)))
    assert.ok(pageProblems(page({ events: [event({ title: "x".repeat(301) })] }), options).some((problem) => /title/.test(problem)))
    assert.ok(pageProblems(page({ events: [event({ text: "x".repeat(4097) })] }), options).some((problem) => /text/.test(problem)))
    assert.ok(pageProblems(page({ events: [event({ url: "http://pilot.slack.com" })] }), options).some((problem) => /url must be https/.test(problem)))
    assert.ok(pageProblems(page({ events: [event({ hash: "nope" })] }), options).some((problem) => /hash must be/.test(problem)))
    assert.ok(pageProblems(page({ events: [event(), event()] }), options).some((problem) => /appears twice/.test(problem)))
  })

  test("an empty page carries a cursor", () => {
    assert.ok(pageProblems(page({ events: [], cursor: "" }), options).some((problem) => /no cursor/.test(problem)))
    assert.deepEqual(pageProblems(page({ events: [], cursor: "c1" }), options), [])
  })
})

describe("the declaration rules a JSON Schema cannot carry", () => {
  const problems = (item: Record<string, unknown>): readonly string[] => declarationProblems(declarationOf(item), { tools: TOOLS })

  test("a well-formed source has no problems, and every named tool is read-only", () => {
    assert.deepEqual(problems(slackItem()), [])
    const notReadOnly = [...TOOLS.filter((tool) => tool.id !== "slack_read_thread"), { id: "slack_read_thread", readOnly: false }]
    assert.ok(
      declarationProblems(declarationOf(slackItem()), { tools: notReadOnly }).some((problem) => /readOnly: true/.test(problem)),
    )
    assert.ok(declarationProblems(declarationOf(slackItem()), { tools: [] }).some((problem) => /does not declare/.test(problem)))
  })

  test("a write verb in a name is refused, and a compound name", () => {
    assert.match(nameProblem("slack_send_message") ?? "", /write verb send/)
    assert.match(nameProblem("get_and_save") ?? "", /joins two actions/)
    assert.match(nameProblem("list_then_delete") ?? "", /joins two actions/)
    assert.equal(nameProblem("calendar_today"), undefined)
    // A name may read without a verb: §2.2's own tool is calendar_today.
    assert.equal(readVerbProblem("calendar_today")?.includes("no read verb"), true)
    assert.ok(problems(slackItem({ tool: "slack_send_message" })).some((problem) => /write verb send/.test(problem)))
    assert.ok(problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: "slack_get_and_save" } })).some((problem) => /joins two actions/.test(problem)))
  })

  test("an operation's last segment starts with a read verb, and carries no write verb", () => {
    for (const operation of ["gmail.users.messages.insert", "gmail.users.messages.batchModify", "gmail.users.watch", "calendar.events.quickAdd", "gmail.users.messages.emptyTrash", "gmail.users.messages.untrash"]) {
      assert.ok(operationProblem(operation) !== undefined, operation)
    }
    assert.equal(operationProblem("gmail.users.messages.get"), undefined)
    assert.equal(operationProblem("slack_read_channel"), undefined)
    assert.equal(operationProblem("slack_list_user_channels"), undefined)
    assert.match(operationProblem("gmail.users.messages.send") ?? "", /write verb send/)
    assert.match(operationProblem("slack_send_message") ?? "", /write verb send/)
    assert.ok(problems(slackItem({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "gmail.users.messages.insert"] } })).some((problem) => /does not start with a read verb/.test(problem)))
  })

  test("an action is in the plugin's namespace and carries no write verb", () => {
    assert.ok(problems(slackItem({ permission: { events: "gws.events_list", operations: ["slack_read_channel"] } })).some((problem) => /not in the plugin's namespace/.test(problem)))
    assert.ok(problems(slackItem({ permission: { events: "slack_send_message", operations: ["slack_read_channel"] } })).some((problem) => /write verb send/.test(problem)))
  })

  test("details name event fields, and the items are unique", () => {
    assert.deepEqual(DETAIL_FIELDS.includes("thread"), true)
    assert.deepEqual(DETAIL_FIELDS.includes("text"), false)
    assert.ok(problems(slackItem({ details: [{ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["title"] }] })).some((problem) => /item text/.test(problem)))
    assert.ok(problems(slackItem({ details: [{ id: "other.thread", tool: "slack_read_thread", from: ["thread"] }] })).some((problem) => /namespace/.test(problem)))
    assert.ok(
      problems(
        slackItem({
          details: [
            { id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] },
            { id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] },
          ],
        }),
      ).some((problem) => /two entries with the id/.test(problem)),
    )
  })

  test("ids, scope keys and operations are unique", () => {
    const two = declarationProblems({ contractVersion: 1, items: [slackItem(), slackItem()] }, { tools: TOOLS })
    assert.ok(two.some((problem) => /share the id/.test(problem)))
    assert.ok(problems(slackItem({ scope: { keys: ["channels", "channels"], describe: "Which" } })).some((problem) => /names "channels" twice/.test(problem)))
    assert.ok(
      problems(slackItem({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_read_channel"] } })).some((problem) => /lists "slack_read_channel" twice/.test(problem)),
    )
  })

  test("urlHosts is refused when it is too broad to mean anything", () => {
    for (const host of ["*.co.uk", "co.uk", "*.cloudfront.net", "github.io", "evil.herokuapp.com", "*.vercel.app", "doubleclick.net", "*.google-analytics.com", "*.com", "xn--slck-cqa.com", "*.com.de", "files.xn--slck-cqa.com"]) {
      assert.ok(urlHostProblem(host) !== null, host)
      assert.ok(problems(slackItem({ urlHosts: [host] })).some((problem) => /urlHosts/.test(problem)), host)
    }
    for (const host of ["slack.com", "*.slack.com", "files.example.co.uk", "*.files.example.co.uk"]) {
      assert.equal(urlHostProblem(host), null, host)
    }
    assert.deepEqual(problems(slackItem({ urlHosts: ["slack.com"] })), [])
  })

  test("suggest names a declared read-only tool", () => {
    assert.deepEqual(problems(slackItem()), [])
    assert.ok(problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: "slack_delete_channel" } })).some((problem) => /write verb delete/.test(problem)))
    assert.ok(problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: "slack_list_unknown" } })).some((problem) => /does not declare/.test(problem)))
  })

  test("assertDeclaration throws one error with a code and a next step", () => {
    assert.doesNotThrow(() => assertDeclaration(declarationOf(slackItem()), { tools: TOOLS }))
    assert.throws(() => assertDeclaration(declarationOf(slackItem({ tool: "slack_send_message" })), { tools: TOOLS }), /^Error: SCHEMA_VIOLATION: .*Next step: /)
  })
})

describe("the recording permission context", () => {
  test("it holds exactly the grants, refuses anything else, and reports what it saw", async () => {
    const grants: Grant[] = [{ action: "slack_events_list", resource: "*" }]
    const recording = recordingPermission(grants)
    await recording.permission.assert({ action: "slack_events_list" })
    await assert.rejects(recording.permission.assert({ action: "slack_slack_read_channel" }), /PERMISSION_DENIED: .*Next step: /)
    assert.deepEqual(recording.assertions.map((assertion) => assertion.action), ["slack_events_list", "slack_slack_read_channel"])
    assert.deepEqual(recording.undeclared, ["slack_slack_read_channel"])
  })

  test("a grant is derived, never hand-written", () => {
    assert.deepEqual(grantsFor(sourceOf(gwsItem())), [
      { action: "gws.events_list", resource: "*" },
      { action: "gws.read", resource: "{account}:gmail.users.getProfile" },
      { action: "gws.read", resource: "{account}:gmail.users.messages.get" },
    ])
    assert.deepEqual(grantsFor(sourceOf(slackItem())), [
      { action: "slack_events_list", resource: "*" },
      { action: "slack_slack_read_user_profile", resource: "*" },
      { action: "slack_slack_read_channel", resource: "*" },
      { action: "slack_slack_read_thread", resource: "*" },
      { action: "slack_slack_list_user_channels", resource: "*" },
    ])
  })
})

describe("sourceConformance", () => {
  const cases: PageCase[] = [{ name: "a page", input: { account: ACCOUNT } }]

  const session = (over: Partial<ConformanceCalls> = {}): ConformanceCalls => ({
    probe: async (_input, context) => {
      await context.permission.assert({ action: "slack_events_list" })
      await context.permission.assert({ action: "slack_slack_read_user_profile" })
      return { account: ACCOUNT, owner: { id: "slack:U0PILOTOWN", label: "Pilot Owner" } }
    },
    ...over,
  })

  const list = (answer: Record<string, unknown> = page()): ConformanceCalls["list"] => async (_input, context) => {
    await context.permission.assert({ action: "slack_events_list" })
    await context.permission.assert({ action: "slack_slack_read_channel" })
    return answer
  }

  const full = (over: Partial<ConformanceCalls> = {}): ConformanceCalls =>
    session({
      list: list(),
      details: {
        "slack.workspace.thread": async (_input, context) => {
          await context.permission.assert({ action: "slack_slack_read_thread" })
          return page()
        },
      },
      suggest: async (_input, context) => {
        await context.permission.assert({ action: "slack_slack_list_user_channels" })
        return { options: [{ id: "C0PILOT001", label: "project-harbour" }] }
      },
      ...over,
    })

  const run = (calls: ConformanceCalls, over: Record<string, unknown> = {}) =>
    sourceConformance({ plugin: PLUGIN, source: sourceOf(slackItem()), tools: TOOLS, cases, calls, account: ACCOUNT, ...over })

  test("a source that asserts exactly its grants passes every check", async () => {
    const report = await run(full())
    assert.deepEqual(report.problems, [])
    assert.equal(report.ok, true)
    assert.deepEqual(
      report.checks.map((check) => check.name),
      ["declaration", "page-result", "failed-holds-cursor", "gap-and-cursor-expired", "refused-is-final", "billed-cost", "probe", "details", "suggest", "unused-grants"],
    )
  })

  test("a declared grant no read asserts is reported", async () => {
    const report = await run(full({ suggest: async () => ({ options: [] }) }))
    assert.ok(report.problems.some((problem) => /slack_slack_list_user_channels.*no read asserts/.test(problem)))
  })

  test("probe reads no content and asserts only its own grant", async () => {
    const withContent = await run(full({ probe: async () => ({ account: ACCOUNT, owner: null, events: [event()] }) }))
    assert.ok(withContent.problems.some((problem) => /must read no content/.test(problem)))
    const overAsserting = await run(full({ probe: async (_input, context) => {
      await context.permission.assert({ action: "gws.read" })
      return { account: ACCOUNT, owner: null }
    } }))
    assert.ok(overAsserting.problems.some((problem) => /PERMISSION_DENIED|not among the grants/.test(problem)))
  })

  test("a detail read is called with the fields it names, and asserts only its grant", async () => {
    const seen: unknown[] = []
    const report = await run(
      full({
        details: {
          "slack.workspace.thread": async (input, context) => {
            seen.push(input)
            await context.permission.assert({ action: "slack_slack_read_thread" })
            return page()
          },
        },
      }),
    )
    assert.equal(report.ok, true)
    assert.deepEqual(seen, [{ account: ACCOUNT, scope: {}, fields: { thread: "conformance-thread:1" } }])
    const stray = detailInputProblems({ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }, {
      account: ACCOUNT,
      scope: {},
      fields: { thread: "t", text: SENTINEL },
    })
    assert.ok(stray.some((problem) => /which its from does not name/.test(problem)))
    assert.ok(stray.some((problem) => /title or text/.test(problem)))
  })

  test("an expired cursor round-trips through a gap", async () => {
    const answers: Record<string, unknown> = {
      stale: page({ gap: { reason: "expired", since: ISO }, cursor: "fresh" }),
      fresh: page({ cursor: "fresh-2" }),
    }
    const report = await run(
      full({
        list: async (input, context) => {
          await context.permission.assert({ action: "slack_slack_read_channel" })
          const cursor = typeof input["cursor"] === "string" ? input["cursor"] : ""
          return answers[cursor]
        },
      }),
      { cases: [{ name: "an expired cursor", input: { cursor: "stale" }, expect: "expired" }] },
    )
    assert.deepEqual(report.problems, [])
  })

  test("an expired cursor that expires again fails the round trip", async () => {
    const report = await run(
      full({
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page({ gap: { reason: "expired", since: ISO }, cursor: "fresh" })
        },
      }),
      { cases: [{ name: "an expired cursor", input: { cursor: "stale" }, expect: "expired" }] },
    )
    assert.ok(report.problems.some((problem) => /expired again/.test(problem)))
  })

  test("CURSOR_EXPIRED round-trips through the backfill hint", async () => {
    const report = await run(
      full({
        list: async (input, context) => {
          await context.permission.assert({ action: "slack_slack_read_channel" })
          if (input["cursor"] === "stale") {
            throw Object.assign(new Error("CURSOR_EXPIRED: the history is gone. Next step: read again with since."), { since: ISO })
          }
          return page()
        },
      }),
      { cases: [{ name: "an expired cursor", input: { cursor: "stale" }, expect: "expired" }] },
    )
    assert.deepEqual(report.problems, [])
  })

  test("failed[] that advances the cursor is reported", async () => {
    const report = await run(
      full({
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page({ failed: [{ external_id: "C0PILOT001:1", reason: "RATE_LIMITED" }], cursor: "c2" })
        },
      }),
      { cases: [{ name: "a page with a failed event", input: { cursor: "c1", account: ACCOUNT } }] },
    )
    assert.ok(report.problems.some((problem) => /holds the cursor back/.test(problem)))
    const check = report.checks.find((entry) => entry.name === "failed-holds-cursor")
    assert.equal(check?.ran, true)
  })

  test("a suggestion lists values a person may confirm", () => {
    assert.deepEqual(suggestProblems({ options: [] }, "suggest"), [])
    assert.ok(suggestProblems({ options: [{ id: "" }] }, "suggest").length > 0)
    assert.ok(suggestProblems({ options: [{ id: "a" }, { id: "a" }] }, "suggest").some((problem) => /twice/.test(problem)))
    assert.ok(suggestProblems({ values: [] }, "suggest").some((problem) => /options must be/.test(problem)))
  })

  test("assertConformance names a code and a next step", async () => {
    const report = await run(full({ suggest: undefined, details: undefined }))
    assert.equal(report.ok, false)
    assert.throws(() => assertConformance(report), /^Error: CONFORMANCE_FAILED: .*Next step: /)
  })
})
