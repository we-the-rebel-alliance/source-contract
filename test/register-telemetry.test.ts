import assert from "node:assert/strict"
import { generateKeyPairSync } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, test } from "node:test"
import { signGrant } from "../src/grant.ts"
import { manifestHash } from "../src/manifest.ts"
import { register, type HandlerTable, type MethodHandler } from "../src/register.ts"
import { defaultEventLogPath } from "../src/register/telemetry.ts"
import { createEventLog, validateEvent, type TelemetryEvent } from "../src/telemetry.ts"
import { manifest } from "./support/manifest.ts"
import { makeHarness } from "./support/register-context.ts"

const temp = mkdtempSync(join(tmpdir(), "plugin-contract-register-telemetry-"))
after(() => rmSync(temp, { recursive: true, force: true }))

const OBJECT = { type: "object", additionalProperties: true } as const
const EMPTY = { type: "object", properties: {}, additionalProperties: false } as const

/** A manifest with only the methods these tests call. */
const demo = (): any => {
  const value = manifest()
  value.methods = {
    status: { class: "read", accounts: "none" },
    events_list: { class: "read", accounts: "optional" },
    plan_send: { class: "read", accounts: "optional", plans: true },
    send_message: { class: "send", accounts: "optional", commits: "plan_send", operations: ["demo.messages.create"] },
    fail: { class: "read", accounts: "none" },
  }
  value.sources = []
  value.actions = []
  value.events = {}
  return value
}

const handler = (over: Partial<MethodHandler> = {}): MethodHandler => ({
  description: "A method.",
  input: EMPTY,
  output: OBJECT,
  run: async () => ({}),
  ...over,
})

function handlers(over: Partial<Record<string, MethodHandler>> = {}): HandlerTable {
  return {
    status: handler({ run: async () => ({ ok: true }) }),
    events_list: handler({
      input: { type: "object", properties: { cursor: { type: "string" } }, additionalProperties: false },
      run: async (_input, call) => ({ account: call.account, events: [{ external_id: "one" }, { external_id: "two" }], cost: { usd: 0.25 } }),
    }),
    plan_send: handler({ run: async () => ({ method: "send_message", output: { text: "provider secret text" } }) }),
    send_message: handler({ run: async () => ({ sent: true }) }),
    fail: handler({ run: async () => Promise.reject(new Error("INPUT_INVALID: the token ghp_abcdefghijklmnop1234 is not ours. Next step: Sign in again.")) }),
    ...over,
  }
}

const context = (over: Record<string, unknown> = {}) => ({
  sessionID: "s1",
  agent: "build",
  messageID: "msg_1",
  id: "call_1",
  signal: new AbortController().signal,
  progress: async () => {},
  ...over,
})

let logCount = 0
const logPath = (): string => join(temp, `events-${++logCount}.jsonl`)
const eventsOf = (path: string): TelemetryEvent[] => createEventLog({ path }).read()
const field = (event: TelemetryEvent, name: string): unknown => event.data[name]?.value

describe("register: the event envelope", () => {
  test("a read, a plan and a commit each append exactly one event of their catalogue type", async () => {
    const h = makeHarness()
    const path = logPath()
    await register(h.ctx, demo(), handlers(), { telemetry: { path, version: "1.2.3", deployment: "test" } })

    const input = { cursor: "ghp_abcdefghijklmnop1234" }
    const read = await h.tools.get("demo_events_list")!.tool.execute(input, context())
    assert.deepEqual(read.output, { account: "default", events: [{ external_id: "one" }, { external_id: "two" }], cost: { usd: 0.25 } })
    const plan = await h.tools.get("demo_plan_send")!.tool.execute({}, context())
    const planId = (plan.output as { planId: string }).planId
    assert.deepEqual((await h.tools.get("demo_send_message")!.tool.execute({ planId }, context())).output, { sent: true })

    const events = eventsOf(path)
    assert.deepEqual(events.map((event) => event.type), ["plugin.read.v1", "plugin.plan.v1", "plugin.commit.v1"])
    for (const event of events) assert.equal(validateEvent(event).ok, true)

    const [readEvent, planEvent, commitEvent] = events
    assert.equal(readEvent!.source, "plugin://demo/1.2.3/test")
    assert.equal(field(readEvent!, "method"), "events_list")
    assert.equal(field(readEvent!, "method_class"), "read")
    assert.equal(field(readEvent!, "effect"), "none")
    assert.equal(field(readEvent!, "account"), "default")
    assert.equal(field(readEvent!, "consumer"), "build")
    assert.equal(field(readEvent!, "allowed_by"), "rule")
    assert.equal(field(readEvent!, "outcome"), "ok")
    assert.equal(field(readEvent!, "count"), 2)
    assert.equal(field(readEvent!, "cost_usd"), 0.25)
    assert.equal(typeof field(readEvent!, "duration_ms"), "number")
    assert.ok((field(readEvent!, "duration_ms") as number) >= 0)

    assert.equal(field(planEvent!, "method"), "plan_send")
    assert.equal(field(planEvent!, "method_class"), "read")
    assert.equal(field(planEvent!, "outcome"), "ok")
    assert.equal(Object.hasOwn(planEvent!.data, "count"), false, "a plan carries no read count")

    assert.equal(field(commitEvent!, "method"), "send_message")
    assert.equal(field(commitEvent!, "method_class"), "send")
    assert.equal(field(commitEvent!, "allowed_by"), "rule")
    assert.equal(field(commitEvent!, "outcome"), "ok")

    assert.match(readEvent!.subject ?? "", /agent=agent_[0-9a-f]{32};session=session_[0-9a-f]{32}/)
    assert.equal((readEvent!.subject ?? "").includes("build"), false, "an agent id is a pseudonym, never the raw id")
    assert.equal((readEvent!.subject ?? "").includes("s1"), false, "a session id is a pseudonym, never the raw id")

    const text = readFileSync(path, "utf8")
    assert.equal(text.includes("ghp_abcdefghijklmnop1234"), false, "a tool's input never reaches the log")
    assert.equal(text.includes("provider secret text"), false, "a tool's answer never reaches the log")
  })

  test("a tool door names the rule the gate evaluated", async () => {
    const asked = makeHarness()
    asked.sessions.get("s1")!.permissions = [{ action: "demo.events_list", resource: "*", effect: "ask" }]
    const askedPath = logPath()
    await register(asked.ctx, demo(), handlers(), { telemetry: { path: askedPath } })
    await asked.tools.get("demo_events_list")!.tool.execute({}, context())
    assert.equal(field(eventsOf(askedPath)[0]!, "allowed_by"), "ask")

    const allowed = makeHarness()
    const allowedPath = logPath()
    await register(allowed.ctx, demo(), handlers(), { telemetry: { path: allowedPath } })
    const plan = await allowed.tools.get("demo_plan_send")!.tool.execute({}, context())
    const planId = (plan.output as { planId: string }).planId
    await allowed.tools.get("demo_send_message")!.tool.execute({ planId }, context())
    const commit = eventsOf(allowedPath).find((event) => event.type === "plugin.commit.v1")
    assert.equal(field(commit!, "allowed_by"), "rule")
  })

  test("a call refused before the gate appends one refusal event with its code", async () => {
    const h = makeHarness()
    const path = logPath()
    await register(h.ctx, demo(), handlers(), { telemetry: { path } })

    await assert.rejects(h.tools.get("demo_events_list")!.tool.execute({ account: "missing" }, context()), /ACCOUNT_UNKNOWN/)
    const events = eventsOf(path)
    assert.equal(events.length, 1)
    assert.equal(events[0]!.type, "plugin.refused.v1")
    assert.equal(field(events[0]!, "method"), "events_list")
    assert.equal(field(events[0]!, "outcome"), "ACCOUNT_UNKNOWN")
    assert.equal(field(events[0]!, "allowed_by"), "none")
    assert.equal(field(events[0]!, "account"), "unknown", "the caller's account text is not logged before it resolves")
  })

  test("a handler failure appends one refusal with its code, and no message", async () => {
    const h = makeHarness()
    const path = logPath()
    await register(h.ctx, demo(), handlers(), { telemetry: { path } })

    await assert.rejects(h.tools.get("demo_fail")!.tool.execute({}, context()), /INPUT_INVALID: .*Next step: Sign in again\./)
    const events = eventsOf(path)
    assert.equal(events.length, 1)
    assert.equal(events[0]!.type, "plugin.refused.v1")
    assert.equal(field(events[0]!, "method"), "fail")
    assert.equal(field(events[0]!, "outcome"), "INPUT_INVALID")
    assert.equal(field(events[0]!, "allowed_by"), "rule")
    assert.equal(readFileSync(path, "utf8").includes("ghp_abcdefghijklmnop1234"), false, "a refusal's message never reaches the log")
  })

  test("an unwritable log leaves the call's answer unchanged", async () => {
    const h = makeHarness()
    const blocked = join(temp, "not-a-directory")
    writeFileSync(blocked, "a file, not a directory")
    const path = join(blocked, "events.jsonl")
    await register(h.ctx, demo(), handlers(), { telemetry: { path } })

    const result = await h.tools.get("demo_events_list")!.tool.execute({}, context())
    assert.deepEqual(result.output, { account: "default", events: [{ external_id: "one" }, { external_id: "two" }], cost: { usd: 0.25 } })
    assert.equal(existsSync(path), false)
  })

  test("door 3 writes one event for a read and one for a refusal", async () => {
    const h = makeHarness()
    const path = logPath()
    await register(h.ctx, demo(), handlers(), { telemetry: { path } })

    assert.deepEqual(await h.rpc.call("demo", "status", { sessionID: "s1", input: {} }), { ok: true })
    await assert.rejects(h.rpc.call("demo", "send_message", { sessionID: "s1", input: { planId: "missing" } }))

    const events = eventsOf(path)
    assert.deepEqual(events.map((event) => event.type), ["plugin.read.v1", "plugin.refused.v1"])
    assert.equal(field(events[0]!, "method"), "status")
    assert.equal(field(events[0]!, "consumer"), "build")
    assert.equal(field(events[0]!, "allowed_by"), "rule")
    assert.equal(field(events[0]!, "count"), 0, "an answer without a page counts zero events")
    assert.equal(Object.hasOwn(events[0]!.data, "cost_usd"), false, "an answer without a cost leaves it out")
    assert.equal(field(events[1]!, "method"), "send_message")
    assert.equal(field(events[1]!, "outcome"), "PLAN_INVALID")
    assert.equal(field(events[1]!, "allowed_by"), "none")
  })

  test("a permission ask and a host-signed grant are named as the confirmation", async () => {
    const asked = makeHarness({ options: { access: "ask-changes" } })
    const askedPath = logPath()
    await register(asked.ctx, demo(), handlers(), { telemetry: { path: askedPath } })
    const askedPlan = (await asked.rpc.call("demo", "plan_send", { sessionID: "s1", input: {} })) as { planId: string }
    assert.deepEqual(await asked.rpc.call("demo", "send_message", { sessionID: "s1", input: { planId: askedPlan.planId } }), { sent: true })
    const askedCommit = eventsOf(askedPath).find((event) => event.type === "plugin.commit.v1")
    assert.equal(field(askedCommit!, "allowed_by"), "ask")

    const { publicKey, privateKey } = generateKeyPairSync("ed25519")
    const now = 1_800_000_000
    const own = demo()
    const granted = makeHarness({ options: { access: "ask-changes" } })
    const grantedPath = logPath()
    await register(granted.ctx, own, handlers(), {
      telemetry: { path: grantedPath },
      grant: {
        keys: { keys: { host_test: publicKey } },
        audience: "@we-the-rebel-alliance/demo-plugin",
        store: { consume: async () => true },
        now: () => now,
      },
    })
    const plan = (await granted.rpc.call("demo", "plan_send", { sessionID: "s1", input: {} })) as { planId: string }
    const input = { planId: plan.planId }
    const token = signGrant({
      key: privateKey,
      kid: "host_test",
      audience: "@we-the-rebel-alliance/demo-plugin",
      consumer: "consumer:demo",
      capability: "demo.send_message",
      account: "default",
      act: "demo.send_message",
      manifest: manifestHash(own),
      jti: "grant_register_telemetry_1",
      iat: now,
      exp: now + 60,
      input,
      cfm: true,
    })
    assert.deepEqual(await granted.rpc.call("demo", "send_message", { sessionID: "s1", input, grant: token, consumer: "consumer:demo" }), { sent: true })
    const grantedCommit = eventsOf(grantedPath).find((event) => event.type === "plugin.commit.v1")
    assert.equal(field(grantedCommit!, "allowed_by"), "grant")
    assert.equal(field(grantedCommit!, "consumer"), "consumer:demo")
  })

  test("the default log is under the plugin's data directory", async () => {
    const previous = process.env["XDG_DATA_HOME"]
    process.env["XDG_DATA_HOME"] = temp
    try {
      assert.equal(defaultEventLogPath("demo"), join(temp, "opencode", "plugin-data", "demo", "events.jsonl"))
      const h = makeHarness()
      await register(h.ctx, demo(), handlers())
      await h.tools.get("demo_status")!.tool.execute({}, context())
      const events = eventsOf(defaultEventLogPath("demo"))
      assert.equal(events.length, 1)
      assert.equal(events[0]!.type, "plugin.read.v1")
    } finally {
      if (previous === undefined) delete process.env["XDG_DATA_HOME"]
      else process.env["XDG_DATA_HOME"] = previous
    }
  })
})
