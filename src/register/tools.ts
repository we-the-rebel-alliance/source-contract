/**
 * Door 1 and door 2: the agent tool and Code Mode, from the same handler table (contract §9).
 *
 * Every method becomes one tool in the plugin's namespace `<name>`, with permission action `<name>.<method>`; OpenCode
 * exposes it as `tools.<name>.<method>` in Code Mode and as `<name>_<method>` to a model. `pinned: true` sets Code
 * Mode's `pinned` flag instead of the deprecated top-level one.
 *
 * The tool's executor runs the same prepared-call path as every other door: input and answer validation, account
 * resolution and the one permission gate are not reimplemented here.
 */
import type { Plugin } from "@opencode/plugin"
import { callEffect, gate } from "./assertions.ts"
import { permissionRefusal, RegisterError } from "./errors.ts"
import type { MethodEntry } from "./handlers.ts"
import { execute, prepareCall, toolCall, type BusReader, type CallEnvironment } from "./invoke.ts"
import { rulesOf, type RpcContext } from "./rpc.ts"
import type { CallTrace } from "./telemetry.ts"

/** The tool context an executor receives, as much of OpenCode's `ToolContext` as this module uses. */
export interface ToolCallContext {
  readonly sessionID: string
  readonly agent: string
  readonly messageID: string
  readonly id: string
  readonly signal: AbortSignal
  readonly codemode?: boolean
  readonly progress: (update: Readonly<Record<string, unknown>>) => Promise<void>
}

/** The value schema and options a tool registration carries. */
export interface ToolRegistration {
  readonly name: string
  readonly description: string
  readonly input: Readonly<Record<string, unknown>>
  readonly output: Readonly<Record<string, unknown>>
  readonly options: {
    readonly namespace: string
    readonly permission: string
    readonly codemode: boolean | { readonly pinned?: boolean; readonly description?: string; readonly input?: unknown; readonly output?: unknown }
  }
  execute(input: unknown, context: ToolCallContext): Promise<{ readonly output: unknown; readonly content: string }>
}

/** The editor inside `ctx.tool.transform`, as this module uses it. */
export interface ToolEditor {
  namespace(namespace: { readonly name: string; readonly description: string }): void
  add(tool: ToolRegistration): void
}

/** The part of the plugin context the tools use. */
export interface ToolContext {
  readonly permission: {
    assert(input: {
      readonly sessionID: string
      readonly agent?: string
      readonly action: string
      readonly resources: readonly string[]
      readonly save?: readonly string[]
      readonly source?: { readonly type: "tool"; readonly messageID: string; readonly id: string }
    }): Promise<void>
  }
  /** The session and agent the call runs as, read only to name the rule the gate evaluated. */
  readonly session: RpcContext["session"]
  readonly agent: RpcContext["agent"]
  /** The editor is `unknown` here because the host's `ToolEditor.add` is generic over each schema type; `installTools`
   * narrows it to `ToolEditor`, exactly as the accounts module narrows its transforms. */
  readonly tool: { readonly transform: (callback: (editor: unknown) => void) => Promise<{ dispose(): Promise<void> }> }
}

const hostContextIsToolContext = (context: Pick<Plugin.Context, "tool" | "permission" | "session" | "agent">): ToolContext => context
void hostContextIsToolContext

/** The text a direct agent tool shows for an answer. A string is itself; anything else is its JSON. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** The Code Mode options of one method: the flag, or Code Mode's entry object when `pinned`. */
function codemodeFor(entry: MethodEntry): ToolRegistration["options"]["codemode"] {
  return entry.item.pinned === true ? { pinned: true } : true
}

/** The tool registrations, built once, so a test can inspect them before OpenCode runs them. */
export function toolRegistrations(environment: CallEnvironment, context: ToolContext, bus: BusReader): readonly ToolRegistration[] {
  return environment.entries.map((entry) => ({
    name: entry.name,
    description: entry.handler.description,
    input: entry.input,
    output: entry.output,
    options: { namespace: environment.name, permission: `${environment.name}.${entry.name}`, codemode: codemodeFor(entry) },
    async execute(raw, callContext) {
      let prepared: ReturnType<typeof prepareCall> | undefined
      const door = callContext.codemode === true ? "codemode" : "tool"
      const trace: CallTrace = {
        sessionID: callContext.sessionID,
        agent: callContext.agent,
        account: "unknown",
        consumer: callContext.agent.trim() === "" ? "unknown" : callContext.agent,
        allowedBy: "none",
      }
      const started = performance.now()
      let effect: "allow" | "deny" | "ask" = "allow"
      try {
        prepared = prepareCall(entry, raw, environment.accounts, environment.plans)
        trace.account = prepared.account
        try {
          const resolved = await rulesOf(context, callContext.sessionID)
          effect = callEffect(environment.name, entry, prepared.account, resolved.rules)
        } catch {
          // The gate remains the authority; the event names the rule path only when it can be read.
        }
        await gate(context, environment.name, entry, callContext, prepared.account, {
          save: true,
          source: { type: "tool", messageID: callContext.messageID, id: callContext.id },
        })
        trace.allowedBy = effect === "ask" ? "ask" : "rule"
        const value = await execute(environment, entry, prepared, toolCall(callContext, door), bus)
        environment.telemetry.record({ entry, door, trace, outcome: "ok", durationMs: performance.now() - started, value })
        return { output: value, content: textOf(value) }
      } catch (error) {
        // A refusal before the handler releases the plan; after the handler starts, consume already made this a no-op.
        if (prepared?.reservation !== undefined) environment.plans.release(prepared.reservation)
        const failure = error instanceof RegisterError ? error.refusal : permissionRefusal(error, `${environment.name}.${entry.name}`)
        environment.telemetry.record({ entry, door, trace, outcome: failure.code, durationMs: performance.now() - started })
        throw new Error(failure.message)
      }
    },
  }))
}

/** Register every tool in the plugin's namespace, and return the registration to dispose. */
export async function installTools(context: ToolContext, environment: CallEnvironment, bus: BusReader): Promise<{ dispose(): Promise<void> }> {
  const tools = toolRegistrations(environment, context, bus)
  return (await context.tool.transform((raw) => {
    const editor = raw as ToolEditor
    editor.namespace({ name: environment.name, description: environment.manifest.plugin.summary })
    for (const tool of tools) editor.add(tool)
  })) as { dispose(): Promise<void> }
}
