/**
 * Door 3: the typed RPC, one registration per plugin (contract §9).
 *
 *   POST /api/rpc/<name>/<method>
 *   { "sessionID": "<session>", "input": <the method's input> }
 *
 * The call runs as the session and agent it names, under the session's rules. A read runs when the gate allows it. A
 * non-read method is capped by the plugin's own `access` level first: under `read-only` it is refused even with a
 * grant; under `ask-changes` or `all` it needs one of contract §8's two confirmations, a permission ask the gate
 * resolves to `ask`, or a host-signed action grant in the envelope's `grant` with the `consumer` it was issued to. An
 * `allow` rule is not a confirmation; without one of the two, the call is refused. This is LD-5.
 *
 * Every call, read or write, then passes the one gate (`./assertions.ts`) exactly once. The gate never saves for RPC:
 * an answer applies to that one call.
 *
 * The registration carries the bus's events block (`busEvents(name)`); a second registration with the same id would
 * hide it, so the plugin registers once, and `register` wraps that one registration with the bus writer.
 */
import { randomUUID } from "node:crypto"
import type { Plugin } from "@opencode/plugin"
import { methodAction, type AccessLevel } from "../access.ts"
import { busEvents } from "../bus.ts"
import { verifyGrant, type GrantKeys, type GrantScope, type GrantStore } from "../grant.ts"
import type { JsonSchema } from "../manifest.ts"
import { callEffect, gate } from "./assertions.ts"
import { permissionRefusal, refusal, refusalOf, RegisterError, type Refusal } from "./errors.ts"
import type { MethodEntry } from "./handlers.ts"
import { execute, prepareCall, type BusReader, type CallEnvironment } from "./invoke.ts"
import { accountOf, type CallTrace } from "./telemetry.ts"
import { validate } from "./validate.ts"

/** The envelope's failure, as the RPC declares it: the code and the next step beside the message. */
const FAILED = {
  type: "object",
  properties: { code: { type: "string" }, next: { type: "string" } },
  required: ["code", "next"],
  additionalProperties: false,
} as const

/** What the plugin wires into the grant verifier: the host's keys, the audience and the durable ledger. */
export interface GrantWiring {
  /** The public keys the host signs with, by `kid`, and revoked ids. */
  readonly keys: GrantKeys
  /** The plugin's package name, which the grant's `aud` must name. */
  readonly audience: string
  /** Where single use is recorded; the plugin backs it with durable storage. */
  readonly store: GrantStore
  /** The scope the grant must name; `{}` (the whole method) when absent. */
  readonly scope?: GrantScope
  /** The current time in seconds; the real clock when absent. */
  readonly now?: () => number
}

/** A context that can answer a refusal, as OpenCode's RPC call context does. */
export interface RpcCallContext {
  readonly signal: AbortSignal
  error(type: "failed", message: string, data: { readonly code: string; readonly next: string }): unknown
}

/** The part of the plugin context the RPC uses. */
export interface RpcContext {
  readonly session: {
    get(input: { readonly sessionID: string }): Promise<{ readonly agent?: string; readonly permissions?: readonly { readonly action: string; readonly resource: string; readonly effect: "allow" | "deny" | "ask" }[] }>
  }
  readonly agent: {
    get(input: { readonly agentID: string }): Promise<{ readonly data: { readonly permissions: readonly { readonly action: string; readonly resource: string; readonly effect: "allow" | "deny" | "ask" }[] } }>
  }
  readonly permission: {
    assert(input: {
      readonly sessionID: string
      readonly agent?: string
      readonly action: string
      readonly resources: readonly string[]
      readonly save?: readonly string[]
      readonly source?: { readonly type: "tool"; readonly messageID: string; readonly id: string }
    }): Promise<void>
    hook(
      name: "evaluate",
      callback: (event: { effect: "allow" | "deny" | "ask"; source?: { readonly id: string } }) => void | Promise<void>,
    ): Promise<{ dispose(): Promise<void> }>
    /** The session's pending asks, so a cancelled call can reject its own. */
    list?(input: { readonly sessionID: string }): Promise<readonly { readonly id: string; readonly source?: { readonly type: "tool"; readonly messageID: string; readonly id: string } | undefined }[]>
    /** Answer a pending ask; a cancellation answers `reject`. */
    reply?(input: { readonly sessionID: string; readonly requestID: string; readonly decision: "reject"; readonly message?: string | undefined }): Promise<void>
  }
  readonly rpc: {
    register(definition: unknown, handlers: Readonly<Record<string, (input: unknown, context: RpcCallContext) => Promise<unknown>>>): Promise<RpcRegistration>
  }
}

/** One live registration, as OpenCode returns it: a disposer and the events emitter. */
export interface RpcRegistration {
  readonly events: { emit(name: string, data: unknown): Promise<void> }
  dispose(): Promise<void>
}

/**
 * The host's context is assignable to this module's: checked at compile time, so a plugin passes `ctx` as it is. The
 * RPC domain is generic over each method's envelope; this module's structural `register` keeps the published
 * declaration free of the host types and the envelope validator checks every key at runtime.
 */
const hostContextIsRpcContext = (context: Pick<Plugin.Context, "rpc" | "session" | "agent" | "permission">): RpcContext => context
void hostContextIsRpcContext

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A JSON Schema with a Standard Schema validator attached, so OpenCode refuses unknown envelope keys. */
function strictEnvelope(input: JsonSchema): JsonSchema {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      sessionID: { type: "string", minLength: 1 },
      input,
      grant: { type: "string", minLength: 1 },
      consumer: { type: "string", minLength: 1 },
    },
    required: ["sessionID", "input"],
    additionalProperties: false,
  }
  Object.defineProperty(schema, "~standard", {
    enumerable: false,
    value: {
      version: 1,
      vendor: "plugin-contract",
      validate(value: unknown) {
        const checked = validate(schema, value)
        return checked.ok ? { value: checked.value } : { issues: checked.problems.map((message) => ({ message })) }
      },
    },
  })
  return schema
}

/** The action a grant names: the declared action this method commits, or the method itself when it commits none. */
function grantAct(environment: CallEnvironment, entry: MethodEntry): string {
  return environment.manifest.actions.find((action) => action.commit === entry.name)?.id ?? methodAction(environment.name, entry.name)
}

/** The grant actions: every non-read method needs a confirmation. A read needs no grant. */
function grantActions(environment: CallEnvironment): Readonly<Record<string, "required">> {
  const actions: Record<string, "required"> = {}
  for (const entry of environment.entries) if (entry.item.class !== "read") actions[grantAct(environment, entry)] = "required"
  return actions
}

/** The session's agent and rules: the agent's, then the session's, as OpenCode reads them. */
async function rulesOf(context: RpcContext, sessionID: string): Promise<{ readonly agent: string; readonly rules: readonly { readonly action: string; readonly resource: string; readonly effect: "allow" | "deny" | "ask" }[] }> {
  let info: Awaited<ReturnType<RpcContext["session"]["get"]>>
  try {
    info = await context.session.get({ sessionID })
  } catch {
    throw new RegisterError(refusal("UNAVAILABLE", `there is no session '${sessionID}' in this location`, "Pass a session that exists, or create one first."))
  }
  if (info.agent === undefined || info.agent === "") {
    throw new RegisterError(refusal("PERMISSION_DENIED", `session '${sessionID}' names no agent`, "Use a session with an agent, so its rules can decide the call."))
  }
  let agent: Awaited<ReturnType<RpcContext["agent"]["get"]>>
  try {
    agent = await context.agent.get({ agentID: info.agent })
  } catch {
    throw new RegisterError(refusal("PERMISSION_DENIED", `session '${sessionID}' names the agent '${info.agent}', which does not exist in this location`, "Use a session whose agent exists."))
  }
  return { agent: info.agent, rules: [...agent.data.permissions, ...(info.permissions ?? [])] }
}

interface Verified {
  readonly ok: true
  readonly account: string
}
interface Unverified {
  readonly ok: false
  readonly refusal: Refusal
  readonly code: string
}
type Verdict = Verified | Unverified

/** A verified grant for exactly `account`, or a `GRANT_INVALID` refusal. */
async function verify(environment: CallEnvironment, wiring: GrantWiring, request: Record<string, unknown>, entry: MethodEntry, account: string): Promise<Verdict> {
  const token = request["grant"]
  if (typeof token !== "string" || token === "") return { ok: false, refusal: refusal("GRANT_INVALID", "the grant is not a token", "Pass the grant the host signed, or use a permission ask."), code: "GRANT_MALFORMED" }
  const consumer = request["consumer"]
  if (typeof consumer !== "string" || consumer === "") return { ok: false, refusal: refusal("GRANT_INVALID", "the grant names no consumer", "Pass the consumer the grant was issued to."), code: "GRANT_CLAIMS_INVALID" }
  const checked = await verifyGrant({
    grant: token,
    input: request["input"],
    act: grantAct(environment, entry),
    actions: grantActions(environment),
    keys: wiring.keys,
    audience: wiring.audience,
    consumer,
    capability: methodAction(environment.name, entry.name),
    account,
    ...(wiring.scope === undefined ? {} : { scope: wiring.scope }),
    manifest: environment.hash,
    now: wiring.now?.() ?? Math.floor(Date.now() / 1000),
    store: wiring.store,
  })
  return checked.ok
    ? { ok: true, account: checked.claims.account }
    : { ok: false, refusal: refusal("GRANT_INVALID", checked.reason, "Ask the host to issue a fresh grant for this action and input."), code: checked.code }
}

/**
 * The RPC call: the plugin's level, the two confirmations for a non-read, the one gate, then the same handler path
 * every door uses.
 */
async function invoke(
  context: RpcContext,
  environment: CallEnvironment,
  level: AccessLevel,
  entry: MethodEntry,
  wiring: GrantWiring | undefined,
  raw: unknown,
  rpc: RpcCallContext,
  freshAsks: Set<string>,
  bus: BusReader,
): Promise<unknown> {
  let prepared: Awaited<ReturnType<typeof prepareCall>> | undefined
  const trace: CallTrace = {
    sessionID: "unknown",
    agent: "unknown",
    account: accountOf(plain(raw) ? raw["input"] : undefined),
    consumer: "unknown",
    allowedBy: "none",
  }
  const started = performance.now()
  try {
    if (!plain(raw)) throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope must be an object", 'Pass {"sessionID":"<session>","input":<the method\'s input>}.'))
    const sessionID = raw["sessionID"]
    if (typeof sessionID !== "string" || sessionID === "") throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope needs a sessionID", "Pass the session the call runs as."))
    trace.sessionID = sessionID
    const input = raw["input"]
    if (!plain(input)) throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope needs an input object", "Pass the method's input as the envelope's input."))
    const resolved = await rulesOf(context, sessionID)
    trace.agent = resolved.agent
    trace.consumer = typeof raw["consumer"] === "string" && raw["consumer"] !== "" ? raw["consumer"] : resolved.agent
    const nonRead = entry.item.class !== "read"
    // A method's own `effect: "deny"` is final for every class, a read too: a fenced session allows the method, and that
    // allow must never override a method the plugin turned off. The level's own refusals stay below, so each message
    // names the setting that actually decides the call.
    if (entry.item.effect === "deny") {
      throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is off under the plugin's access setting`, "Change the method's effect or the plugin's access setting."))
    }
    const callID = `rpc:${randomUUID()}`
    let gated = false
    let fresh = false
    let readAllowedBy: "ask" | "rule" = "rule"
    if (nonRead) {
      // The plugin's own setting is final: a caller's session rules can narrow it, never widen it (contract §13).
      if (level === "read-only") {
        throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is a ${entry.item.class} and the plugin's access is read-only`, "Set access to ask-changes, or use the agent tool in a session that allows it."))
      }
      if (raw["grant"] !== undefined) {
        if (wiring === undefined) throw new RegisterError(refusal("GRANT_INVALID", "this plugin has no grant verifier, so it cannot accept a grant", "Use a permission ask in a session, or configure the plugin's grant verifier."))
        // A commit resolves its plan's account first, so the grant must name that account; a grant for another account
        // is ACCOUNT_MISMATCH, not a silent run as the first alias.
        prepared = prepareCall(entry, input, environment.accounts, environment.plans)
        trace.account = prepared.account
        const checked = await verify(environment, wiring, raw, entry, prepared.account)
        if (!checked.ok) {
          const failure =
            entry.item.commits !== undefined && checked.code === "GRANT_ACCOUNT_MISMATCH"
              ? refusal("ACCOUNT_MISMATCH", "the grant names another account than the plan", "Issue the grant for the account the plan was made for.")
              : checked.refusal
          throw new RegisterError(failure)
        }
        // A valid grant is the confirmation, so no ask is needed. A session deny still narrows the plugin's level.
        if (callEffect(environment.name, entry, prepared.account, resolved.rules) === "deny") {
          throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is denied for this session's agent`, "Use a session whose agent allows it."))
        }
        trace.allowedBy = "grant"
        gated = true
      } else {
        prepared = prepareCall(entry, input, environment.accounts, environment.plans)
        trace.account = prepared.account
        const effect = callEffect(environment.name, entry, prepared.account, resolved.rules)
        if (effect === "allow") {
          // An allow rule is not a confirmation. Run the gate first so it is the one permission evaluation, then refuse.
          await gate(context, environment.name, entry, { sessionID, agent: resolved.agent, messageID: "msg_rpc", id: callID, signal: rpc.signal }, prepared.account, { save: false })
          gated = true
          throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is a ${entry.item.class} and an allow rule is not a confirmation for RPC`, "A non-read method over RPC needs a permission ask or a host-signed action grant."))
        }
        fresh = effect === "ask"
      }
    } else {
      prepared = prepareCall(entry, input, environment.accounts, environment.plans)
      trace.account = prepared.account
      readAllowedBy = callEffect(environment.name, entry, prepared.account, resolved.rules) === "ask" ? "ask" : "rule"
    }
    if (prepared === undefined) throw new RegisterError(refusal("UNAVAILABLE", "the RPC call prepared no input", "Try again; if it keeps failing, check the plugin's status."))
    if (!gated) {
      // The source carries the RPC call's id on every ask, fresh or not: it is the handle a cancellation uses to
      // reject the request this call left pending. `fresh` decides only the one-call evaluate behaviour.
      const source = { type: "tool" as const, messageID: "msg_rpc", id: callID }
      if (fresh) freshAsks.add(callID)
      try {
        // The evaluate hook reads `freshAsks`: for a fresh ask it turns an allow that came only from a saved approval
        // back into ask. The source is on every ask, so a cancellation can always find the request it opened.
        await gate(context, environment.name, entry, { sessionID, agent: resolved.agent, messageID: "msg_rpc", id: callID, signal: rpc.signal }, prepared.account, { save: false, source })
        trace.allowedBy = nonRead ? "ask" : readAllowedBy
      } catch (error) {
        throw new RegisterError(permissionRefusal(error, `${environment.name}.${entry.name}`))
      } finally {
        if (fresh) freshAsks.delete(callID)
      }
    }
    const messageID = "msg_rpc"
    const id = `rpc:${randomUUID()}`
    const value = await execute(environment, entry, prepared, { sessionID, agent: resolved.agent, messageID, id, signal: rpc.signal, progress: async () => {}, door: "rpc" }, bus)
    const answer = value === undefined ? null : JSON.parse(JSON.stringify(value))
    environment.telemetry.record({ entry, door: "rpc", trace, outcome: "ok", durationMs: performance.now() - started, value: answer })
    return answer
  } catch (error) {
    // A refusal before the handler releases the plan; after the handler starts, consume already made this a no-op.
    if (prepared?.reservation !== undefined) environment.plans.release(prepared.reservation)
    const own = refusalOf(error)
    const failure = own ?? refusal("UNAVAILABLE", "the RPC call failed", "Try again; if it keeps failing, check the plugin's status.")
    environment.telemetry.record({ entry, door: "rpc", trace, outcome: failure.code, durationMs: performance.now() - started })
    return rpc.error("failed", failure.message, { code: failure.code, next: failure.next })
  }
}

/** The RPC definition and handlers, and the one registration that carries the bus events. */
export async function installRpc(context: RpcContext, environment: CallEnvironment, level: AccessLevel, wiring: GrantWiring | undefined, bus: BusReader): Promise<RpcRegistration> {
  const methods: Record<string, unknown> = {}
  const handlers: Record<string, (input: unknown, call: RpcCallContext) => Promise<unknown>> = {}
  for (const entry of environment.entries) {
    methods[entry.name] = { input: strictEnvelope(entry.input), output: entry.output, errors: { failed: FAILED } }
    handlers[entry.name] = (raw: unknown, call: RpcCallContext) => invoke(context, environment, level, entry, wiring, raw, call, freshAsks, bus)
  }
  // Only the events the manifest declares: an undeclared bus event must not be publishable (contract §10 and §16).
  const events = Object.fromEntries(Object.entries(busEvents(environment.name)).filter(([event]) => Object.hasOwn(environment.manifest.events, event)))
  const definition = { id: environment.name, methods, events }
  const freshAsks = new Set<string>()
  const hook = await context.permission.hook("evaluate", (event) => {
    if (event.source !== undefined && freshAsks.has(event.source.id) && event.effect !== "deny") event.effect = "ask"
  })
  let registration: RpcRegistration
  try {
    registration = await context.rpc.register(definition, handlers)
  } catch (error) {
    await hook.dispose().catch(() => undefined)
    throw error
  }
  return {
    events: registration.events,
    async dispose() {
      await hook.dispose().catch(() => undefined)
      await registration.dispose()
    },
  }
}
