// v2.3: the opt-in per-method resource resolver. A plugin method with `resource(input)` is resolved before dispatch on
// `<account>:<operation>` instead of `*`; a rule on that resource grants exactly that read; `null` is refused naming
// the input; a read method's operation must be a read; a method without a resolver keeps v2's `*` (the v2 suites in
// this folder prove the rest of v2 unchanged).
import { describe, test } from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect } from "./support/expect.ts"
import { evaluate, readOperation, registerToolsRpc, RESOURCE_PATTERN, type MethodSpec, type PluginMethod, type ToolCall } from "../src/tools-rpc.ts"
import { PLUGIN, TOOLS_RPC_ID } from "./support/tools-rpc-block.ts"

type Effect = "allow" | "deny" | "ask"
type Rule = { action: string; resource: string; effect: Effect }
const rule = (action: string, effect: Effect, resource = "*"): Rule => ({ action, resource, effect })
const LOCATION = join(tmpdir(), "tools-rpc-resource")

/** gws-shaped: `read` takes `{ account?, operation }` and asserts `gws.read` on `<account>:<operation>`. */
const resolver = (input: unknown): string | null => {
  const value = input as { account?: unknown; operation?: unknown } | null
  if (!value || typeof value.operation !== "string") return null
  return `${typeof value.account === "string" ? value.account : "default"}:${value.operation}`
}

/** A read method with gws's resolver; `resource: undefined` gives one without a resolver. */
const readMethod = (extra: { readonly [K in keyof PluginMethod]?: PluginMethod[K] | undefined } = {}): PluginMethod => {
  const method: Record<string, unknown> = {
    kind: "plugin",
    class: "read",
    name: "read",
    action: "gws.read",
    description: "A read",
    input: { type: "object" },
    output: { type: "object" },
    run: async (input: unknown, call: ToolCall) => ({ ran: input, resource: call.resource ?? null }),
    resource: resolver,
    ...extra,
  }
  for (const key of Object.keys(method)) if (method[key] === undefined) delete method[key]
  return method as unknown as PluginMethod
}

async function setup(agent: Rule[], methods: MethodSpec[] = [readMethod()], session: Rule[] = []) {
  const runs: ToolCall[] = []
  const wrapped = methods.map((method): MethodSpec => (method.kind === "plugin" ? { ...method, run: async (input, call) => (runs.push(call), method.run(input, call)) } : method))
  let contract: any
  let handlers: Record<string, (input: unknown, context: unknown) => Promise<any>> = {}
  const ctx = {
    location: { directory: LOCATION },
    rpc: { register: async (definition: unknown, registered: typeof handlers) => ((contract = definition), (handlers = registered), { dispose: async () => {} }) },
    permission: { hook: async () => ({ dispose: async () => {} }) },
    session: { get: async ({ sessionID }: { sessionID: string }) => (sessionID === "ses_1" ? { agent: "build", permissions: session } : Promise.reject(Object.assign(new Error("no"), { _tag: "Session.NotFoundError" }))) },
    agent: { get: async () => ({ data: { permissions: agent } }) },
    tool: { list: async () => [] },
    mcp: { list: async () => ({ data: [] }) },
  }
  await registerToolsRpc(ctx as never, { plugin: PLUGIN, methods: wrapped })
  const call = (method: string, input: unknown) =>
    handlers[method]!({ sessionID: "ses_1", input }, { signal: new AbortController().signal, error: (type: string, message: string, data: unknown) => ({ type, message, data }) })
  return { call, runs, contract: () => contract, describe: (input: unknown = {}) => handlers.describe!(input, { signal: new AbortController().signal, error: (type: string, message: string, data: unknown) => ({ type, message, data }) }) }
}

const BASE = rule("*", "allow")
const GET = { account: "work", operation: "gmail.users.messages.get" }

describe("the resource resolver", () => {
  test("a rule on <account>:<operation> grants exactly that read, and the run gets the resource", async () => {
    const h = await setup([BASE, rule("gws.*", "ask"), rule("gws.read", "allow", "work:gmail.users.messages.get")])
    expect(await h.call("read", GET)).toEqual({ ran: GET, resource: "work:gmail.users.messages.get" })
    expect(h.runs.map((run) => run.resource)).toEqual(["work:gmail.users.messages.get"])
  })

  test("another operation, or the same operation on another account, is refused before dispatch", async () => {
    const h = await setup([BASE, rule("gws.*", "ask"), rule("gws.read", "allow", "work:gmail.users.messages.get")])
    const other = await h.call("read", { account: "work", operation: "gmail.users.messages.list" })
    expect(other).toMatchObject({ type: "failed", data: { code: "PERMISSION_DENIED" } })
    expect(other.message).toBe(
      "PERMISSION_DENIED: gws.read on work:gmail.users.messages.list would ask for this session's agent, and a script cannot answer. Next step: Add an allow rule for gws.read on the resource work:gmail.users.messages.list to the session's agent or to the session, or use a session whose agent allows it.",
    )
    expect(await h.call("read", { account: "personal", operation: "gmail.users.messages.get" })).toMatchObject({ data: { code: "PERMISSION_DENIED" } })
    expect(h.runs).toEqual([])
  })

  test("a wildcard rule still matches: `*` and `work:*` allow, a later deny on the resource refuses", async () => {
    expect(await (await setup([BASE])).call("read", GET)).toMatchObject({ resource: "work:gmail.users.messages.get" })
    const scoped = await setup([BASE, rule("gws.*", "ask"), rule("gws.read", "allow", "work:*")])
    expect(await scoped.call("read", GET)).toMatchObject({ resource: "work:gmail.users.messages.get" })
    expect(await scoped.call("read", { ...GET, account: "home" })).toMatchObject({ data: { code: "PERMISSION_DENIED" } })
    const denied = await setup([BASE, rule("gws.read", "deny", "work:gmail.users.messages.get")])
    const refused = await denied.call("read", GET)
    expect(refused).toMatchObject({ data: { code: "PERMISSION_DENIED" } })
    expect(refused.message).toContain("gws.read on work:gmail.users.messages.get is denied for this session's agent")
    expect(denied.runs).toEqual([])
  })

  test("the session's rules apply after the agent's, on the resource too", async () => {
    const h = await setup([BASE, rule("gws.*", "ask")], [readMethod()], [rule("gws.read", "allow", "work:gmail.users.messages.get")])
    expect(await h.call("read", GET)).toMatchObject({ resource: "work:gmail.users.messages.get" })
  })

  test("null, a throw, or a malformed resource is RESOURCE_UNRESOLVED, naming the input, with no run", async () => {
    const h = await setup([BASE])
    const none = await h.call("read", { account: "work" })
    expect(none).toMatchObject({ type: "failed", data: { code: "RESOURCE_UNRESOLVED" } })
    expect(none.message).toBe(
      "RESOURCE_UNRESOLVED: read's input names no account and operation for gws.read to be resolved on. Next step: Pass the input that names the operation and its account, as describe's input schema for the method shows.",
    )
    const throwing = await setup([BASE], [readMethod({ resource: () => { throw new Error("bad input") } })])
    expect(await throwing.call("read", GET)).toMatchObject({ data: { code: "RESOURCE_UNRESOLVED" } })
    for (const bad of ["*:gmail.users.messages.get", "work:*", "work", "work:gmail users", "a:b:c", ":x.get"]) {
      const malformed = await setup([BASE], [readMethod({ resource: () => bad })])
      expect(await malformed.call("read", GET), bad).toMatchObject({ data: { code: "RESOURCE_UNRESOLVED" } })
      expect(malformed.runs, bad).toEqual([])
    }
    expect(h.runs).toEqual([])
  })

  test("a plugin's own next step for RESOURCE_UNRESOLVED replaces the shared one", async () => {
    const own = { ...PLUGIN, nextSteps: { ...PLUGIN.nextSteps, RESOURCE_UNRESOLVED: "Pass operation, as gws_schema shows." } }
    let handlers: Record<string, (input: unknown, context: unknown) => Promise<any>> = {}
    const ctx = {
      location: { directory: LOCATION },
      rpc: { register: async (_definition: unknown, registered: typeof handlers) => ((handlers = registered), { dispose: async () => {} }) },
      permission: { hook: async () => ({ dispose: async () => {} }) },
      session: { get: async () => ({ agent: "build" }) },
      agent: { get: async () => ({ data: { permissions: [BASE] } }) },
      tool: { list: async () => [] },
      mcp: { list: async () => ({ data: [] }) },
    }
    await registerToolsRpc(ctx as never, { plugin: own, methods: [readMethod()] })
    const refused = await handlers.read!({ sessionID: "ses_1", input: {} }, { signal: new AbortController().signal, error: (type: string, message: string, data: unknown) => ({ type, message, data }) })
    expect(refused.data).toEqual({ code: "RESOURCE_UNRESOLVED", next: "Pass operation, as gws_schema shows." })
  })

  test("a read method's operation must be a read: messages.insert, batchModify, watch and the like are refused", async () => {
    const h = await setup([BASE])
    for (const operation of ["gmail.users.messages.insert", "gmail.users.messages.batchModify", "gmail.users.watch", "calendar.events.quickAdd", "gmail.users.messages.untrash", "drive.files.emptyTrash", "gmail.users.messages.getaway"]) {
      const refused = await h.call("read", { account: "work", operation })
      expect(refused, operation).toMatchObject({ type: "failed", data: { code: "PERMISSION_DENIED" } })
      expect(refused.message, operation).toContain("is not a read operation")
    }
    expect(h.runs).toEqual([])
    for (const operation of ["gmail.users.messages.get", "gmail.users.getProfile", "gmail.users.history.list", "drive.files.list", "people.searchContacts", "calendar.calendarList.get"]) {
      expect(await h.call("read", { account: "work", operation }), operation).toMatchObject({ resource: `work:${operation}` })
    }
  })

  test("a write method may resolve a write operation: only a read is held to read verbs", async () => {
    const write = readMethod({ name: "commit", class: "write", action: "gws.write" })
    const h = await setup([BASE, rule("gws.write", "ask"), rule("gws.write", "allow", "work:gmail.users.messages.insert")], [write])
    expect(await h.call("commit", { account: "work", operation: "gmail.users.messages.insert" })).toMatchObject({ resource: "work:gmail.users.messages.insert" })
    expect(await h.call("commit", { account: "work", operation: "gmail.users.messages.send" })).toMatchObject({ data: { code: "PERMISSION_DENIED" } })
  })

  test("a method without a resolver resolves on `*`, as v2: a rule on a resource does not grant it", async () => {
    const plain = readMethod({ resource: undefined })
    const h = await setup([BASE, rule("gws.*", "ask"), rule("gws.read", "allow", "work:gmail.users.messages.get")], [plain])
    expect(await h.call("read", GET)).toMatchObject({ data: { code: "PERMISSION_DENIED" } })
    const open = await setup([BASE], [plain])
    expect(await open.call("read", GET)).toEqual({ ran: GET, resource: null })
    expect(open.runs[0]!.resource).toBeUndefined()
  })

  test("describe marks a method with a resolver operationScoped, gives permission on `*`, and leaves others as v2", async () => {
    const h = await setup([BASE, rule("gws.*", "ask")], [readMethod(), readMethod({ name: "catalog", action: "gws.catalog", resource: undefined })])
    const description = await h.describe({ sessionID: "ses_1" })
    expect(description.id).toBe(TOOLS_RPC_ID)
    expect(description.methods[0]).toMatchObject({ name: "read", operationScoped: true, permission: "ask" })
    expect(Object.hasOwn(description.methods[1], "operationScoped")).toBe(false)
    expect(h.contract().methods.describe.output.properties.methods.items.properties.operationScoped).toEqual({ type: "boolean" })
  })

  test("registration refuses a resolver that is not a function, or one on an MCP method", async () => {
    await expect(setup([BASE], [readMethod({ resource: "work:x.get" as never })])).rejects.toThrow(/resource must be a function/)
    const ctx = { rpc: { register: async () => ({ dispose: async () => {} }) }, permission: { hook: async () => ({ dispose: async () => {} }) } }
    const steps = { ...PLUGIN.nextSteps, AUTH_REQUIRED: "a.", CONNECTING: "a.", CONNECTION_FAILED: "a.", DISABLED: "a.", NOT_REGISTERED: "a.", TOOL_UNAVAILABLE: "a.", UPSTREAM_ERROR: "a." }
    await expect(
      registerToolsRpc(ctx as never, { plugin: { ...PLUGIN, nextSteps: steps }, methods: [{ kind: "mcp", name: "m", class: "read", resource: resolver } as never], mcp: { server: "srv", managed: () => true } }),
    ).rejects.toThrow(/cannot have a resource resolver/)
  })
})

describe("the helpers", () => {
  test("evaluate takes a resource, `*` by default, with the host's wildcards and last-match-wins", () => {
    const rules = [rule("*", "allow"), rule("gws.read", "ask", "work:*"), rule("gws.read", "allow", "work:gmail.users.messages.get")]
    expect(evaluate(rules, "gws.read")).toBe("allow")
    expect(evaluate(rules, "gws.read", "work:drive.files.list")).toBe("ask")
    expect(evaluate(rules, "gws.read", "work:gmail.users.messages.get")).toBe("allow")
    expect(evaluate([], "gws.read", "work:x.get")).toBe("ask")
  })

  test("readOperation reads the last dotted segment's verb; RESOURCE_PATTERN wants <account>:<operation>", () => {
    for (const yes of ["users.messages.get", "getProfile", "list", "x.searchContacts", "x.history", "x.count", "x.status", "x.lookup_by_id"]) expect(readOperation(yes), yes).toBe(true)
    for (const no of ["users.messages.insert", "batchGet", "getaway", "listing", "x.watch", "x.stop", ""]) expect(readOperation(no), no).toBe(false)
    expect(RESOURCE_PATTERN.test("work:gmail.users.messages.get")).toBe(true)
    expect(RESOURCE_PATTERN.test("T0ACME0001:conversations.history")).toBe(true)
    for (const no of ["work", "work:", ":get", "w*:get", "work:get?", "work:a..b"]) expect(RESOURCE_PATTERN.test(no), no).toBe(false)
  })
})
