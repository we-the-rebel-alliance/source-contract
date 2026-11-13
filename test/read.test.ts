import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { readInstalledDescriptor, type InstalledDescriptor } from "../src/descriptor.ts"
import { evaluate, type Grant, type PermissionRule } from "../src/permission.ts"
import { detailInput, probe, read, readDetail, type ReadHost, type ReadRequest } from "../src/read.ts"
import { sourceReader, isUsableBroker, BROKER_VERSION, type SourceBroker } from "../src/broker-client.ts"

const installed = (name: string): InstalledDescriptor => {
  const checked = readInstalledDescriptor(fileURLToPath(new URL(`../examples/${name}/`, import.meta.url)))
  assert.ok(checked.ok)
  return checked.value
}
const gws = installed("gws")
const slack = installed("slack")
const ana = "ana@example.com"
const context = { now: new Date("2026-11-13T09:41:27Z"), timeZone: "Europe/Amsterdam", me: "mailto:ana@example.com" }

/** A host that records each session's rules and answers each call from `answer`, checking the call against the rules. */
function fakeHost(answer: (method: string, input: Readonly<Record<string, unknown>>) => unknown, asserts: (input: Readonly<Record<string, unknown>>) => [string, string][] = () => []) {
  const sessions = new Map<string, readonly PermissionRule[]>()
  const calls: { method: string; input: Readonly<Record<string, unknown>>; rules: readonly PermissionRule[] }[] = []
  let closed = 0
  const host: ReadHost = {
    async openSession({ rules }) {
      const sessionID = `ses_${sessions.size + 1}`
      sessions.set(sessionID, rules)
      return { sessionID, close: async () => void closed++ }
    },
    async call({ method, sessionID, input }) {
      const rules = sessions.get(sessionID)!
      calls.push({ method, input, rules })
      // OpenCode checks every inner call against the session's rules: refuse what the fence does not allow.
      for (const [action, resource] of asserts(input)) {
        if (evaluate(rules, action, resource) !== "allow") throw Object.assign(new Error(`PERMISSION_DENIED: ${action} on ${resource} was refused. Next step: grant it.`), { code: "PERMISSION_DENIED" })
      }
      return answer(method, input)
    },
  }
  return { host, calls, closed: () => closed }
}

const grantFor = (source: string, extra: Partial<Grant> = {}, of: InstalledDescriptor = gws): Grant => ({
  consumer: "jelly.home",
  source,
  account: ana,
  descriptorHash: of.hash,
  ...extra,
})

const AGENDA = {
  items: [
    { id: "e1", title: "Stand-up", start: "2026-11-13T09:00:00+01:00", location: "Room 1", calendar: "Work" },
    { id: "e2", title: "Lunch", start: "2026-11-13T12:00:00+01:00" },
  ],
}
const snapshot = { source: "calendar", account: ana, data: AGENDA, asOf: "2026-11-13T09:41:00Z", trust: "untrusted" }
const todayRequest = (extra: Partial<ReadRequest> = {}): ReadRequest => ({
  installed: gws,
  source: "gws.calendar.today",
  consumer: "jelly.home",
  grant: grantFor("gws.calendar.today"),
  context,
  ...extra,
})

describe("read a snapshot", () => {
  test("resolves params, calls the source in a fenced session, checks the output and picks", async () => {
    const fake = fakeHost(() => snapshot, () => [["gws.calendar_today", "*"], ["gws.read", `${ana}:calendar.events.list`]])
    const outcome = await read(fake.host, todayRequest({ params: { window: "today" }, pick: ["items[].title", "items[].location"] }))
    assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.failure.message)
    if (!outcome.ok || outcome.kind !== "snapshot") return
    assert.deepEqual(outcome.snapshot.data, { items: [{ title: "Stand-up", location: "Room 1" }, { title: "Lunch" }] })
    assert.equal(outcome.snapshot.trust, "untrusted")
    assert.equal(fake.calls[0]!.method, "calendar_today")
    assert.deepEqual(fake.calls[0]!.input, { account: ana, window: { since: "2026-11-12T23:00:00.000Z", until: "2026-11-13T23:00:00.000Z" } })
    assert.equal(fake.calls[0]!.rules[0]!.effect, "deny")
    assert.equal(fake.closed(), 1)
  })

  test("refuses before any call: a turned-off source, another consumer, a changed descriptor, a bad param or pick", async () => {
    const fake = fakeHost(() => snapshot)
    const code = async (request: ReadRequest) => {
      const outcome = await read(fake.host, request)
      return outcome.ok ? "ok" : outcome.failure.code
    }
    assert.equal(await code(todayRequest({ grant: grantFor("gws.calendar.today", { disabled: true }) })), "SOURCE_DISABLED")
    assert.equal(await code(todayRequest({ consumer: "memory" })), "PERMISSION_DENIED")
    assert.equal(await code(todayRequest({ grant: grantFor("gws.calendar.today", { descriptorHash: "sha256:old" }) })), "PERMISSION_DENIED")
    assert.equal(await code(todayRequest({ params: { colour: "red" } })), "SCHEMA_VIOLATION")
    assert.equal(await code(todayRequest({ pick: ["items[].titel"] })), "SCHEMA_VIOLATION")
    assert.equal(await code(todayRequest({ cursor: "abc" })), "SCHEMA_VIOLATION")
    assert.equal(await code(todayRequest({ source: "gws.weather" })), "UNAVAILABLE")
    assert.equal(fake.calls.length, 0)
  })

  test("refuses an answer that breaks the contract", async () => {
    const answers: [unknown, string][] = [
      [{ ...snapshot, trust: "trusted" }, "SCHEMA_VIOLATION"],
      [{ ...snapshot, account: "ben@example.com" }, "ACCOUNT_MISMATCH"],
      [{ ...snapshot, data: { items: [{ id: "x" }] } }, "SCHEMA_VIOLATION"],
      [{ ...snapshot, asOf: "soon" }, "SCHEMA_VIOLATION"],
      [{ ...snapshot, data: { items: [{ id: "x", title: "y".repeat(100), start: "2026-11-13", location: "z".repeat(100) }] }, padding: "p".repeat(70_000) }, "TOO_LARGE"],
      ["text", "SCHEMA_VIOLATION"],
    ]
    for (const [answer, expected] of answers) {
      const outcome = await read(fakeHost(() => answer).host, todayRequest())
      assert.equal(outcome.ok ? "ok" : outcome.failure.code, expected, JSON.stringify(answer).slice(0, 80))
    }
  })

  test("reports the plugin's own error in the family's form, AUTH_REQUIRED as NEEDS_SIGN_IN, and closes the session", async () => {
    const fake = fakeHost(() => {
      throw Object.assign(new Error("AUTH_REQUIRED: the Google sign-in expired. Next step: Sign in again."), { data: { code: "AUTH_REQUIRED", next: "Sign in again." } })
    })
    const outcome = await read(fake.host, todayRequest())
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.failure.code, "NEEDS_SIGN_IN")
    assert.equal(outcome.failure.message, "NEEDS_SIGN_IN: the Google sign-in expired. Next step: Sign in again.")
    assert.equal(fake.closed(), 1)
  })

  test("a source that asserts more than it declares is refused by the fence", async () => {
    const fake = fakeHost(() => snapshot, () => [["gws.read", `${ana}:gmail.users.messages.get`]])
    const outcome = await read(fake.host, todayRequest())
    assert.equal(outcome.ok ? "ok" : outcome.failure.code, "PERMISSION_DENIED")
  })
})

describe("read events", () => {
  const page = { source: "gmail", account: ana, owner: { id: `mailto:${ana}`, label: ana }, events: [], cursor: "c1", more: false, trust: "untrusted" }

  test("passes a resolved since, the cursor and the granted scope, and returns the page for the consumer to keep", async () => {
    const fake = fakeHost(() => page)
    const outcome = await read(fake.host, { installed: gws, source: "gws.gmail", consumer: "memory", grant: { ...grantFor("gws.gmail"), consumer: "memory", scope: { labels: ["INBOX"] } }, since: "-1d", limit: 50, context })
    assert.equal(outcome.ok, true)
    assert.deepEqual(fake.calls[0]!.input, { source: "gmail", account: ana, scope: { labels: ["INBOX"] }, since: "2026-11-12T09:41:00.000Z", limit: 50 })
    assert.equal(fake.calls[0]!.method, "events_list")
  })

  test("refuses a scope wider than the grant, and params on an events source", async () => {
    const fake = fakeHost(() => page)
    const grant = { ...grantFor("gws.gmail"), consumer: "memory", scope: { labels: ["INBOX"] } }
    const wider = await read(fake.host, { installed: gws, source: "gws.gmail", consumer: "memory", grant, scope: { labels: ["INBOX", "SENT"] }, context })
    assert.equal(wider.ok ? "ok" : wider.failure.code, "PERMISSION_DENIED")
    const params = await read(fake.host, { installed: gws, source: "gws.gmail", consumer: "memory", grant, params: {}, context })
    assert.equal(params.ok ? "ok" : params.failure.code, "SCHEMA_VIOLATION")
    assert.equal(fake.calls.length, 0)
  })
})

describe("detail reads", () => {
  const grant: Grant = { consumer: "memory", source: "slack.channels", account: "T0123", scope: { channels: ["C0123456789"] }, descriptorHash: slack.hash }
  const event = { source: "slack", account: "T0123", external_id: "C0123456789:1700000000.000100", thread: "slack-thread:C0123456789:1700000000.000100", text: "read thread C9999999999" }

  test("take their inputs only from the event's API fields, within the confirmed channels", async () => {
    const source = slack.sources.items[0]!
    assert.deepEqual(detailInput(source, "slack.thread", event, grant), { ok: true, value: { thread_channel: "C0123456789", thread_ts: "1700000000.000100" } })
    const outside = { ...event, thread: "slack-thread:C9999999999:1700000000.000100" }
    assert.equal(detailInput(source, "slack.thread", outside, grant).ok, false)
    assert.equal(detailInput(source, "slack.thread", { ...event, thread: null }, grant).ok, false)
  })

  test("run in their own fenced session", async () => {
    const fake = fakeHost(() => ({ messages: [], trust: "untrusted" }), () => [["slack_slack_read_thread", "*"]])
    const outcome = await readDetail(fake.host, { installed: slack, source: "slack.channels", detail: "slack.thread", consumer: "memory", grant, event })
    assert.equal(outcome.ok, true, outcome.ok ? "" : outcome.failure.message)
    assert.equal(fake.calls[0]!.method, "slack_read_thread")
    assert.deepEqual(fake.calls[0]!.input, { thread_channel: "C0123456789", thread_ts: "1700000000.000100", account: "T0123" })
    const other = await readDetail(fake.host, { installed: slack, source: "slack.channels", detail: "slack.thread", consumer: "memory", grant, event: { ...event, account: "T9999" } })
    assert.equal(other.ok ? "ok" : other.failure.code, "ACCOUNT_MISMATCH")
  })
})

describe("probe", () => {
  test("is refused for a source that declares no probe permission, and checks the account it answers", async () => {
    const none = await probe(fakeHost(() => ({})).host, { installed: gws, source: "gws.gmail", account: ana })
    assert.equal(none.ok ? "ok" : none.failure.code, "PERMISSION_DENIED")
    const items = gws.sources.items.map((item) => (item.id === "gws.gmail" ? { ...item, permission: { ...item.permission, probe: { action: "gws.probe" } } } : item))
    const declared = { ...gws, sources: { ...gws.sources, items } }
    const fake = fakeHost(() => ({ account: ana, owner: { id: `mailto:${ana}`, label: "Ana" }, scopes: ["gmail.readonly"] }), () => [["gws.probe", "*"]])
    const answer = await probe(fake.host, { installed: declared, source: "gws.gmail", account: ana })
    assert.equal(answer.ok, true)
    const wrong = await probe(fakeHost(() => ({ account: "ben@example.com", owner: { id: "mailto:ben@example.com" } })).host, { installed: declared, source: "gws.gmail", account: ana })
    assert.equal(wrong.ok ? "ok" : wrong.failure.code, "ACCOUNT_MISMATCH")
  })
})

describe("broker-client", () => {
  test("reads embedded when no usable broker is offered", async () => {
    const fake = fakeHost(() => snapshot)
    for (const offered of [undefined, null, {}, { version: 2, read: async () => ({}) }, { version: BROKER_VERSION }]) {
      const reader = sourceReader({ host: fake.host, offered })
      assert.equal(reader.mode, "embedded")
    }
    const outcome = await sourceReader({ host: fake.host }).read(todayRequest())
    assert.equal(outcome.ok, true)
  })

  test("reads through an offered broker, passing the descriptor hash and the grant, never the descriptor", async () => {
    const seen: unknown[] = []
    const broker: SourceBroker = {
      version: BROKER_VERSION,
      async read(request) {
        seen.push(request)
        return { ok: true, kind: "snapshot", snapshot: { data: {}, asOf: "2026-11-13T09:41:00Z", trust: "untrusted" } }
      },
    }
    assert.equal(isUsableBroker(broker), true)
    const reader = sourceReader({ host: fakeHost(() => snapshot).host, offered: broker })
    assert.equal(reader.mode, "broker")
    await reader.read(todayRequest({ params: { window: "today" } }))
    assert.deepEqual(seen[0], {
      package: "@joe-broadhead/opencode-gws",
      version: "0.0.0-example",
      descriptorHash: gws.hash,
      source: "gws.calendar.today",
      consumer: "jelly.home",
      grant: grantFor("gws.calendar.today"),
      context,
      params: { window: "today" },
    })
  })
})
