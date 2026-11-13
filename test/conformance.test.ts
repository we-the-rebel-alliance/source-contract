import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { SOURCES_SCHEMA, type SourceItem } from "../src/schema.ts"
import {
  DETAIL_FIELDS,
  SENTINEL,
  assertConformance,
  assertDeclaration,
  declarationProblems,
  detailInputProblems,
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
  scope: { keys: ["channels"], describe: "Channels and direct messages to read.", suggest: { tool: "slack_list_user_channels", operations: ["slack_list_user_channels"] } },
  details: [{ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }],
  permission: {
    events: "slack_events_list",
    operations: ["slack_read_user_profile", "slack_read_channel", "slack_read_thread"],
  },
  cost: { class: "free" },
  private: true,
  ...over,
})

const TOOLS = [
  { id: "events_list", readOnly: true },
  { id: "slack_read_thread", readOnly: true },
  { id: "slack_list_user_channels", readOnly: true },
]

const declarationOf = (item: Record<string, unknown>): { contractVersion: 1; items: Record<string, unknown>[] } => ({ contractVersion: 1, items: [item] })

const sourceOf = (item: Record<string, unknown>): SourceItem => {
  const checked = SOURCES_SCHEMA.check(declarationOf(item))
  if (!checked.ok) throw new Error(checked.problems.join("; "))
  const first = checked.value.items[0]
  if (first === undefined) throw new Error("the declaration parsed to no item")
  return first
}

const page = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  source: "slack.workspace",
  plugin: PLUGIN,
  account: ACCOUNT,
  owner: { id: "slack:U0PILOTOWN", label: "Pilot Owner" },
  asOf: ISO,
  trust: "untrusted",
  events: [{ external_id: "C0PILOT001:1", kind: "message", occurred_at: "2026-11-01T12:30:00.000Z", hash: "sha256:whatever" }],
  cursor: "c1",
  more: false,
  refused: [],
  failed: [],
  ...over,
})

describe("the page fields Memory's checks read", () => {
  const options = { source: sourceOf(slackItem()), plugin: PLUGIN, input: {} }

  test("a page that answers to its source and carries a cursor has no problems", () => {
    assert.deepEqual(pageProblems(page(), options), [])
  })

  test("the page is attributed to its source and plugin", () => {
    assert.ok(pageProblems(page({ source: "other" }), options).some((problem) => /names source/.test(problem)))
    assert.ok(pageProblems(page({ plugin: "other" }), options).some((problem) => /names plugin/.test(problem)))
    assert.ok(pageProblems(page({ cursor: 7 }), options).some((problem) => /cursor must be a string/.test(problem)))
  })

  test("failed[] holds the cursor back", () => {
    const held = page({ failed: [{ external_id: "C0PILOT001:1", code: "RATE_LIMITED" }], cursor: "c2" })
    assert.ok(pageProblems(held, { ...options, input: { cursor: "c1" } }).some((problem) => /holds the cursor back/.test(problem)))
    assert.deepEqual(pageProblems({ ...held, cursor: "c1" }, { ...options, input: { cursor: "c1" } }), [])
    assert.ok(pageProblems(held, options).some((problem) => /holds the cursor back/.test(problem)))
  })

  test("refused[] is final", () => {
    const refused = page({ refused: [{ external_id: "C0PILOT001:1", reason: "instruction-shaped text" }] })
    assert.ok(pageProblems(refused, options).some((problem) => /a refusal is final/.test(problem)))
    assert.ok(pageProblems(page({ refused: [{ external_id: "x" }] }), options).some((problem) => /names no reason/.test(problem)))
  })

  test("gap is shaped and runs forwards", () => {
    assert.deepEqual(pageProblems(page({ gap: { reason: "window-truncated", since: ISO } }), options), [])
    assert.ok(pageProblems(page({ gap: { reason: "nope", since: ISO } }), options).some((problem) => /gap.reason/.test(problem)))
    assert.ok(pageProblems(page({ gap: { reason: "expired", since: ISO, until: "2026-11-01T00:00:00.000Z" } }), options).some((problem) => /is after/.test(problem)))
  })

  test("a billed source reports its cost", () => {
    const billed = sourceOf(slackItem({ cost: { class: "billed", units: [{ per: "post", usd: 0.005 }], probe: { per: "call", usd: 0.01 } } }))
    assert.ok(pageProblems(page(), { ...options, source: billed }).some((problem) => /cost is missing/.test(problem)))
    assert.deepEqual(pageProblems(page({ cost: { usd: 0.005 } }), { ...options, source: billed }), [])
  })

  test("an event must name the id a drop refers to, and nothing else is checked here", () => {
    assert.ok(pageProblems(page({ events: [{ kind: "message" }] }), options).some((problem) => /external_id/.test(problem)))
    // The event's own shape is the events module's; a spare field is not this kit's to refuse.
    assert.deepEqual(pageProblems(page({ events: [{ external_id: "C0PILOT001:2", anything: true }] }), options), [])
  })

  test("a detail page has no cursor to hold back", () => {
    assert.deepEqual(pageProblems(page({ events: [], cursor: "" }), { ...options, detail: true }), [])
    assert.ok(pageProblems(page({ events: [], cursor: "" }), options).some((problem) => /no cursor/.test(problem)))
  })
})

describe("the declaration rules a JSON Schema cannot carry", () => {
  const problems = (item: Record<string, unknown>): readonly string[] => declarationProblems(declarationOf(item), { tools: TOOLS })

  test("a well-formed source has no problems, and every named tool is read-only", () => {
    assert.deepEqual(problems(slackItem()), [])
    const notReadOnly = [...TOOLS.filter((tool) => tool.id !== "slack_read_thread"), { id: "slack_read_thread", readOnly: false }]
    assert.ok(declarationProblems(declarationOf(slackItem()), { tools: notReadOnly }).some((problem) => /readOnly: true/.test(problem)))
    assert.ok(declarationProblems(declarationOf(slackItem()), { tools: [] }).some((problem) => /does not declare/.test(problem)))
  })

  test("names are tokenised, and a write verb where the verb sits is refused", () => {
    assert.match(nameProblem("slack_send_message") ?? "", /write verb send/)
    assert.match(nameProblem("getAndSend") ?? "", /joins two actions/)
    assert.equal(nameProblem("calendar_today"), undefined)
    assert.match(readVerbProblem("calendar_today") ?? "", /no read verb/)
    assert.ok(problems(slackItem({ tool: "slack_send_message" })).some((problem) => /write verb send/.test(problem)))
  })

  test("an operation's last segment is where its verb sits, and a write verb there is refused", () => {
    for (const operation of ["gmail.users.messages.insert", "gmail.users.messages.batchModify", "gmail.users.watch", "calendar.events.quickAdd", "gmail.users.messages.emptyTrash", "gmail.users.messages.untrash"]) {
      assert.ok(operationProblem(operation) !== undefined, operation)
    }
    for (const operation of ["gmail.users.messages.get", "slack_read_channel", "slack_list_user_channels", "drive.files.export", "calendar.events.instances", "gmail.users.messages.batchGet"]) {
      assert.equal(operationProblem(operation), undefined, operation)
    }
    assert.match(operationProblem("gmail.users.messages.send") ?? "", /write verb send/)
    assert.ok(problems(slackItem({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "gmail.users.messages.insert"] } })).some((problem) => /no read verb|write verb insert/.test(problem)))
  })

  test("an action is in the plugin's namespace and carries no write verb", () => {
    assert.ok(problems(slackItem({ permission: { events: "gws.events_list", operations: ["slack_read_channel"] } })).some((problem) => /not in the plugin's namespace/.test(problem)))
    assert.ok(problems(slackItem({ permission: { events: "slack_send_message", operations: ["slack_read_channel"] } })).some((problem) => /write verb send/.test(problem)))
  })

  test("details name event fields, and their ids are in the namespace and unique", () => {
    assert.equal(DETAIL_FIELDS.includes("thread"), true)
    assert.equal(DETAIL_FIELDS.includes("text"), false)
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

  test("ids, scope keys, operations and suggest operations are unique", () => {
    const two = declarationProblems({ contractVersion: 1, items: [slackItem(), slackItem()] }, { tools: TOOLS })
    assert.ok(two.some((problem) => /share the id/.test(problem)))
    assert.ok(problems(slackItem({ scope: { keys: ["channels", "channels"], describe: "Which" } })).some((problem) => /names "channels" twice/.test(problem)))
    assert.ok(
      problems(slackItem({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_read_channel"] } })).some((problem) => /lists "slack_read_channel" twice/.test(problem)),
    )
    assert.ok(
      problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: { tool: "slack_list_user_channels", operations: ["slack_list_user_channels", "slack_list_user_channels"] } } })).some((problem) =>
        /twice/.test(problem),
      ),
    )
  })

  test("urlHosts is refused when it names a public suffix, a shared host or a tracker", () => {
    for (const host of ["*.co.uk", "co.uk", "*.cloudfront.net", "github.io", "evil.herokuapp.com", "*.vercel.app", "doubleclick.net", "*.google-analytics.com", "*.com", "xn--slck-cqa.com", "*.com.de", "files.xn--slck-cqa.com"]) {
      assert.ok(urlHostProblem(host) !== null, host)
      assert.ok(problems(slackItem({ urlHosts: [host] })).some((problem) => /urlHosts/.test(problem)), host)
    }
    for (const host of ["slack.com", "*.slack.com", "files.example.co.uk", "*.files.example.co.uk"]) {
      assert.equal(urlHostProblem(host), null, host)
    }
    assert.deepEqual(problems(slackItem({ urlHosts: ["slack.com"] })), [])
  })

  test("suggest names a declared read-only tool, and its operations stay out of the running grant", () => {
    assert.deepEqual(problems(slackItem()), [])
    assert.ok(problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: { tool: "slack_delete_channel", operations: ["slack_list_user_channels"] } } })).some((problem) => /write verb delete/.test(problem)))
    assert.ok(problems(slackItem({ scope: { keys: ["channels"], describe: "Which", suggest: { tool: "slack_list_unknown", operations: ["slack_list_unknown"] } } })).some((problem) => /does not declare/.test(problem)))
    assert.ok(
      problems(slackItem({ permission: { events: "slack_events_list", operations: ["slack_read_channel", "slack_list_user_channels"] } })).some((problem) => /must not enter the running grant/.test(problem)),
    )
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
})

describe("sourceConformance", () => {
  // Every check must run for a report to be ok, so the fixture covers a page, a failed page, a refused page and an
  // expired cursor, as well as the probe, the detail and the suggestion.
  const cases: PageCase[] = [
    { name: "a page", input: { account: ACCOUNT } },
    { name: "a page with a failed event", input: { cursor: "c2" } },
    { name: "a page with a refused event", input: { cursor: "c3" } },
    { name: "an expired cursor", input: { cursor: "stale" }, expect: "expired" },
  ]

  const list = (): ConformanceCalls["list"] => async (input, context) => {
    await context.permission.assert({ action: "slack_events_list" })
    await context.permission.assert({ action: "slack_slack_read_channel" })
    if (input["cursor"] === "c2") {
      return page({ failed: [{ external_id: "C0PILOT001:2", code: "RATE_LIMITED" }], cursor: "c2" })
    }
    if (input["cursor"] === "c3") {
      return page({ refused: [{ external_id: "C0PILOT001:3", reason: "instruction" }], cursor: "c3" })
    }
    if (input["cursor"] === "stale") return page({ gap: { reason: "expired", since: ISO }, cursor: "fresh" })
    if (input["cursor"] === "fresh") return page({ cursor: "fresh-2" })
    return page()
  }

  const full = (over: Partial<ConformanceCalls> = {}): ConformanceCalls => ({
    list: list(),
    probe: async (_input, context) => {
      await context.permission.assert({ action: "slack_events_list" })
      await context.permission.assert({ action: "slack_slack_read_user_profile" })
      return { account: ACCOUNT, owner: { id: "slack:U0PILOTOWN", label: "Pilot Owner" } }
    },
    details: {
      "slack.workspace.thread": async (input, context) => {
        if (input.fields["thread"] === "slack-thread:C0PILOT003:1") throw new Error("PERMISSION_DENIED: that thread is in a channel nobody confirmed. Next step: confirm the channel it belongs to.")
        await context.permission.assert({ action: "slack_slack_read_thread" })
        return page({ events: [{ external_id: "C0PILOT001:9" }], cursor: "" })
      },
    },
    suggest: async (_input, context) => {
      await context.permission.assert({ action: "slack_slack_list_user_channels" })
      return { options: [{ id: "C0PILOT001", label: "project-harbour" }] }
    },
    ...over,
  })

  const detailCases = [
    { id: "slack.workspace.thread", scope: { channels: ["C0PILOT001"] }, event: { thread: "slack-thread:C0PILOT001:1" } },
    { id: "slack.workspace.thread", scope: { channels: ["C0PILOT001"] }, event: { thread: "slack-thread:C0PILOT003:1" }, expect: { refuses: "PERMISSION_DENIED" } },
  ]

  const run = (calls: ConformanceCalls, over: Record<string, unknown> = {}) =>
    sourceConformance({
      plugin: PLUGIN,
      source: sourceOf(slackItem()),
      tools: TOOLS,
      cases,
      detailCases,
      identityOperations: ["slack_read_user_profile"],
      calls,
      account: ACCOUNT,
      ...over,
    })

  test("a source that asserts exactly its grants passes every check", async () => {
    const report = await run(full())
    assert.deepEqual(report.problems, [])
    assert.equal(report.ok, true)
    assert.equal(report.incomplete, false)
    assert.deepEqual(
      report.checks.map((check) => check.name),
      ["declaration", "page-result", "failed-holds-cursor", "gap-and-cursor-expired", "refused-is-final", "billed-cost", "probe", "details", "suggest", "identity-grants", "unused-grants"],
    )
    assert.deepEqual(
      report.checks.filter((check) => !check.ran).map((check) => check.name),
      ["billed-cost"],
    )
  })

  test("a report with a check that did not run is incomplete and not ok", async () => {
    const report = await run(full(), { cases: [{ name: "a page", input: {} }], detailCases: [] })
    assert.equal(report.ok, false)
    assert.equal(report.incomplete, true)
    assert.ok(report.problems.some((problem) => /has no case outside the confirmed scope/.test(problem)))
    assert.throws(() => assertConformance(report), /^Error: CONFORMANCE_FAILED: .*Next step: /)
  })

  test("a declared grant no read asserts is reported", async () => {
    const report = await run(full({ suggest: async () => ({ options: [] }) }))
    assert.ok(report.problems.some((problem) => /bind declaration grants slack_slack_list_user_channels/.test(problem)), report.problems.join("; "))
  })

  test("probe reads no content and asserts only its own grant", async () => {
    const withContent = await run(full({ probe: async () => ({ account: ACCOUNT, owner: null, events: [] }) }))
    assert.ok(withContent.problems.some((problem) => /must read no content/.test(problem)))
    const overAsserting = await run(
      full({
        probe: async (_input, context) => {
          await context.permission.assert({ action: "gws.read" })
          return { account: ACCOUNT, owner: null }
        },
      }),
    )
    assert.ok(overAsserting.problems.some((problem) => /PERMISSION_DENIED|not among the grants/.test(problem)))
  })

  test("a detail read is called with the fields it names, and asserts only its grant", async () => {
    const seen: unknown[] = []
    const report = await run(
      full({
        details: {
          "slack.workspace.thread": async (input, context) => {
            if (input.fields["thread"] === "slack-thread:C0PILOT003:1") throw new Error("PERMISSION_DENIED: that thread is in a channel nobody confirmed. Next step: confirm the channel it belongs to.")
            seen.push(input)
            await context.permission.assert({ action: "slack_slack_read_thread" })
            return page({ events: [{ external_id: "C0PILOT001:9" }], cursor: "" })
          },
        },
      }),
    )
    assert.equal(report.ok, true, report.problems.join("; "))
    assert.deepEqual(seen[0], { account: ACCOUNT, scope: { channels: ["C0PILOT001"] }, fields: { thread: "slack-thread:C0PILOT001:1" } })
    const stray = detailInputProblems({ id: "slack.workspace.thread", tool: "slack_read_thread", from: ["thread"] }, {
      account: ACCOUNT,
      scope: {},
      fields: { thread: "t", text: SENTINEL },
    })
    assert.ok(stray.some((problem) => /which its from does not name/.test(problem)))
    assert.ok(stray.some((problem) => /title or text/.test(problem)))
  })

  test("an expired cursor round-trips through a gap, and one that expires again fails", async () => {
    const good = await run(full())
    assert.deepEqual(good.problems, [])
    const again = await run(
      full({
        list: async (_input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          return page({ gap: { reason: "expired", since: ISO }, cursor: "fresh" })
        },
      }),
    )
    assert.ok(again.problems.some((problem) => /expired again/.test(problem)))
  })

  test("CURSOR_EXPIRED round-trips through the backfill hint", async () => {
    const report = await run(
      full({
        list: async (input, context) => {
          await context.permission.assert({ action: "slack_events_list" })
          await context.permission.assert({ action: "slack_slack_read_channel" })
          if (input["cursor"] === "stale") {
            throw Object.assign(new Error("CURSOR_EXPIRED: the history is gone. Next step: read again with since."), { since: ISO })
          }
          return page()
        },
      }),
    )
    assert.deepEqual(report.problems, [])
  })

  test("a suggestion lists values a person may confirm", () => {
    assert.deepEqual(suggestProblems({ options: [] }, "suggest"), [])
    assert.ok(suggestProblems({ options: [{ id: "" }] }, "suggest").length > 0)
    assert.ok(suggestProblems({ options: [{ id: "a" }, { id: "a" }] }, "suggest").some((problem) => /twice/.test(problem)))
    assert.ok(suggestProblems({ values: [] }, "suggest").some((problem) => /options must be/.test(problem)))
  })
})
