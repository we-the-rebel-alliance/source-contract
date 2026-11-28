/**
 * `register`: doors 1–3 from one handler table (contract §9), plus the access rules that decide whether a method runs
 * (contract §6).
 *
 *   export default Plugin.define({
 *     id: "slack",
 *     setup: (ctx) => register(ctx, manifest, handlers),
 *   })
 *
 * `register` validates the handler table against the manifest's `methods`, resolves the accounts once, generates the
 * access rules into every agent, registers one tool per method in the plugin's namespace, registers one RPC id
 * `<name>` that carries the bus events, and returns the registration. It always builds the typed bus writer from that
 * one registration and attaches it to every handler call as `call.bus`, and it returns it as `registration.bus`; a
 * plugin never calls `ctx.rpc.register` itself.
 *
 * A handler's input and answer are checked against its schemas, the account is resolved through `accounts`, provider
 * operations are asserted on `<alias>:<operation>`, and a failure is mapped to contract §12. A non-read method over
 * RPC additionally needs a permission ask or a valid action grant (LD-5); see `./rpc.ts`.
 */
import type { Plugin } from "@opencode/plugin"
import { accountsOf, type AccountProfile } from "../accounts.ts"
import type { Manifest } from "../manifest.ts"
import { applyAccess, type AccessContext, type AgentLike } from "../access/agents.ts"
import { installRpc, type GrantWiring, type RpcContext } from "./rpc.ts"
import { installTools, type ToolContext } from "./tools.ts"
import { prepare, type BusReader, type CallEnvironment } from "./invoke.ts"
import type { HandlerTable } from "./handlers.ts"
import { createRegisterTelemetry, type TelemetryWiring } from "./telemetry.ts"
import { assertPluginName, type Bus } from "../bus.ts"
import { createBus } from "../bus/writer.ts"

/** The plugin context the register needs: `ctx`, as OpenCode passes it to `setup`, narrowed structurally. */
export interface RegisterContext {
  /** The plugin's options, from `opencode.json(c)`. */
  readonly options?: Readonly<Record<string, unknown>> | undefined
  readonly agent: AccessContext["agent"] & RpcContext["agent"] & { list(): Promise<{ readonly data: readonly AgentLike[] }> }
  readonly tool: ToolContext["tool"]
  readonly session: RpcContext["session"]
  readonly permission: RpcContext["permission"]
  readonly rpc: RpcContext["rpc"]
}

/** What a plugin may wire into the register beyond the host context: the action-grant verifier and the event log. */
export interface RegisterWiring {
  readonly grant?: GrantWiring | undefined
  /** The local event log and its source; the host's path when it gives one. */
  readonly telemetry?: TelemetryWiring | undefined
}

/** The live registration: the bus over it, and disposing it removes the tools, the RPC id and the rules. */
export interface Registration {
  readonly name: string
  /** The typed bus writer, built from the one RPC registration; every handler call reads the same writer as `call.bus`. */
  readonly bus: Bus
  dispose(): Promise<void>
}

/**
 * The host's context is assignable to this module's: checked at compile time, so a plugin passes `ctx` as it is, and
 * the host types stay out of the published declaration (`npm run check:dist`).
 */
const hostContextIsRegisterContext = (context: Pick<Plugin.Context, "agent" | "tool" | "session" | "permission" | "rpc" | "options">): RegisterContext => context
void hostContextIsRegisterContext

/** The accounts the manifest and options declare, refused as `OPTIONS_INVALID` when they cannot be read. */
function accountsFor(manifest: Manifest, options: Readonly<Record<string, unknown>>): readonly AccountProfile[] {
  const plan = accountsOf(manifest, options)
  if (!plan.ok) {
    throw new Error(`OPTIONS_INVALID: ${plan.problems.join("; ")}. Next step: fix the plugin's accounts option.`)
  }
  return plan.value.accounts
}

/** Run `action`, and dispose what already exists when it fails, so a setup error leaves nothing half-registered. */
async function withCleanup<T>(cleanup: readonly (() => Promise<void>)[], action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    for (const stop of [...cleanup].reverse()) await stop().catch(() => undefined)
    throw error
  }
}

/**
 * Wire the plugin's methods through doors 1–3 and generate its access rules.
 *
 * The table and the manifest must name the same methods; a declared method without a handler is refused at setup, as
 * is a handler the manifest does not declare. The returned registration always carries the bus writer, built from the
 * one RPC registration, and every handler call carries it as `call.bus`.
 */
export async function register(context: RegisterContext, manifest: Manifest, handlers: HandlerTable, wiring: RegisterWiring = {}): Promise<Registration> {
  const name = manifest.plugin.name
  assertPluginName(name)
  const options = context.options ?? {}
  const accounts = accountsFor(manifest, options)
  const access = await applyAccess(context, { manifest, options })
  if (access.problems.length > 0) {
    await access.dispose()
    throw new Error(access.problems.join("\n"))
  }
  return withCleanup([() => access.dispose()], async () => {
    const telemetry = createRegisterTelemetry(manifest, wiring.telemetry)
    const environment: CallEnvironment = prepare(manifest, handlers, accounts, access, async () => (await context.agent.list()).data, telemetry)
    // The RPC registration comes first: the bus wraps its events emitter, and every door reads the one writer. The
    // reader is filled before `register` returns, and no door can run before `setup` returns.
    let bus!: Bus
    const writer: BusReader = () => bus
    const rpc = await installRpc(context, environment, access.level, wiring.grant, writer)
    bus = createBus(name, rpc)
    return withCleanup([() => rpc.dispose()], async () => {
      const tools = await installTools(context, environment, writer)
      return {
        name,
        bus,
        async dispose() {
          await rpc.dispose().catch(() => undefined)
          await tools.dispose().catch(() => undefined)
          await access.dispose().catch(() => undefined)
        },
      }
    })
  })
}
