/**
 * One call through one handler, with the contract's checks around it (contract §6, §9 and §12).
 *
 * The register resolves the account, validates the input, refuses a commit that carries anything but a `planId`, runs
 * the handler, checks the answer (a plan's answer included, and the register mints the plan's id), and maps a refusal.
 * The same path runs behind every door, so an agent tool, Code Mode and RPC cannot disagree about what a method
 * accepts or answers.
 */
import { DEFAULT_ALIAS } from "../accounts/alias.ts"
import { resolveAccount, type AccountProfile } from "../accounts.ts"
import { unguardedAgents, type AccessRegistration, type AgentLike } from "../access/agents.ts"
import type { Bus } from "../bus.ts"
import { manifestHash, type Manifest } from "../manifest.ts"
import { planStore, type PlanReservation, type PlanStore } from "./plans.ts"
import { refusal, refusalOf, refuse, RegisterError, reasonOf, type Refusal } from "./errors.ts"
import { methodEntries, type Door, type HandlerTable, type MethodCall, type MethodEntry } from "./handlers.ts"
import type { RegisterTelemetry } from "./telemetry.ts"
import { validate, validateCommitInput, validatePlanAnswer } from "./validate.ts"

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The environment one call runs in, resolved once by `register`. */
export interface CallEnvironment {
  readonly name: string
  readonly manifest: Manifest
  /** The manifest's hash, as a grant stores it. */
  readonly hash: string
  readonly entries: readonly MethodEntry[]
  readonly accounts: readonly AccountProfile[]
  /** The plans this plugin instance made: a commit runs as the account its plan recorded. */
  readonly plans: PlanStore
  /** The rules `register` generated into every agent, and what status reads them from. */
  readonly access: AccessRegistration
  /** The host's agents as they are when the call asks, so status reads no state kept at setup. */
  readonly agents: () => Promise<readonly AgentLike[]>
  /** The one recorder every door writes its call's event through. */
  readonly telemetry: RegisterTelemetry
}

/**
 * The one bus writer, read when a handler runs. `register` creates it from its single RPC registration, which exists
 * only after the doors are wired, so the doors hold this reader rather than a mutable placeholder; no call can run
 * before `setup` returns.
 */
export type BusReader = () => Bus

/** The handler table and account set, validated once at setup. */
export function prepare(manifest: Manifest, handlers: HandlerTable, accounts: readonly AccountProfile[], access: AccessRegistration, agents: () => Promise<readonly AgentLike[]>, telemetry: RegisterTelemetry): CallEnvironment {
  return { name: manifest.plugin.name, manifest, hash: manifestHash(manifest), entries: methodEntries(manifest, handlers), accounts, plans: planStore(), access, agents, telemetry }
}

/**
 * The handler's input: the account selector removed, then checked against the method's schema. A commit is checked
 * against `{ planId }` alone, whatever the handler's own schema says.
 */
function checkedInput(entry: MethodEntry, raw: unknown): { readonly input: Record<string, unknown>; readonly account: unknown } {
  if (!plain(raw)) refuse("INPUT_INVALID", `${entry.name} takes an object as its input`, "Pass the input its schema describes.")
  const input = { ...raw }
  const account = input["account"]
  if (entry.item.commits !== undefined) {
    if (Object.hasOwn(input, "account")) {
      throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} commits a plan and takes only { planId }; the grant names the account`, "Remove account from the commit input."))
    }
    const checked = validateCommitInput(input)
    if (!checked.ok) throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} commits a plan and takes only { planId }: ${checked.problems.join("; ")}`, "Call the planning method, then pass the planId it answers."))
    return { input: checked.value, account: undefined }
  }
  if (Object.hasOwn(input, "account")) {
    if (entry.item.accounts !== "optional") refuse("INPUT_INVALID", `${entry.name} takes no account`, "Remove account from the input; only a method declared accounts: optional takes one.")
    delete input["account"]
  }
  const checked = validate(entry.input, input)
  if (!checked.ok) throw new RegisterError(refusal("INPUT_INVALID", `${entry.name}'s input breaks its schema: ${checked.problems.join("; ")}`, "Pass only the input the method's schema describes."))
  return { input: checked.value as Record<string, unknown>, account }
}

/** A call's input and the account it resolves to, before any handler runs. */
export interface PreparedCall {
  readonly input: Record<string, unknown>
  readonly account: string
  /** A commit's reservation, released on a refusal before the handler or consumed as it starts. */
  readonly reservation?: PlanReservation
  /** A commit's plan: the plan handler's full answer, which the commit handler receives as `call.plan`. */
  readonly plan?: unknown
}

/**
 * The input checked and the account resolved, or a contract refusal. A commit takes no account: its account is the one
 * a verified grant names, or the plugin's only account, or `default` for the handler to read from the plan.
 */
export function prepareCall(entry: MethodEntry, raw: unknown, accounts: readonly AccountProfile[], plans: PlanStore): PreparedCall {
  const { input, account } = checkedInput(entry, raw)
  if (entry.item.commits !== undefined) {
    const planId = typeof input["planId"] === "string" ? input["planId"] : ""
    const plan = plans.reserve(planId, entry.name)
    if (!plan.ok) throw new RegisterError(refusal(plan.code, plan.problems.join("; "), "Plan again, then commit with the planId it answers."))
    try {
      const resolved = accounts.length === 0 ? { ok: true as const, alias: plan.reservation.account } : resolveAccount(accounts, { account: plan.reservation.account })
      if (!resolved.ok) throw new RegisterError(refusal("ACCOUNT_UNKNOWN", resolved.what, resolved.next))
      return { input, account: resolved.alias, reservation: plan.reservation, plan: plan.reservation.answer }
    } catch (error) {
      // A bad account is a refusal before the handler; the plan stays committable.
      plans.release(plan.reservation)
      throw error
    }
  }
  // A method declared `accounts: "none"` takes no account: it runs as the internal default even when the plugin has
  // several aliases. Only an `accounts: "optional"` method resolves one, and then a missing account is ACCOUNT_REQUIRED.
  const resolved = entry.item.accounts === "optional" ? resolveAccount(accounts, { account }) : { ok: true as const, alias: DEFAULT_ALIAS }
  if (!resolved.ok) throw new RegisterError(refusal(resolved.code, resolved.what, resolved.next))
  return { input, account: resolved.alias }
}

/** The answer, checked; a plan must name the method that commits it, and must not mint its own id. */
export function checkedOutput(entry: MethodEntry, value: unknown): unknown {
  if (entry.item.plans === true) {
    const plan = validatePlanAnswer(value)
    if (!plan.ok) {
      throw new RegisterError(
        refusal("PLAN_INVALID", `${entry.name} must answer { method, output?, … } without a planId: ${plan.problems.join("; ")}`, "Answer the method that commits the plan and §8's preview fields; the register mints the planId."),
      )
    }
    const method = plan.value["method"] as string
    if (entry.commit !== undefined && method !== entry.commit) {
      throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} answers ${method} as the method that commits it, but ${entry.commit} does`, `Answer method: "${entry.commit}".`))
    }
    return plan.value
  }
  const checked = validate(entry.output, value)
  if (!checked.ok) throw new RegisterError(refusal("SCHEMA_VIOLATION", `${entry.name} answered something its schema does not describe: ${checked.problems.join("; ")}`, "Report it to the plugin's maintainers."))
  return checked.value
}

/** The plan fields the contract publishes, beside the minted `planId`; private plan data stays in `call.plan`. */
const PLAN_FIELDS = ["output", "reaches", "changes", "cost", "trust"] as const

/** The public plan answer: the minted id, the committing method, and the preview fields the handler carried. */
function publicPlan(planId: string, answer: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const value: Record<string, unknown> = { planId, method: answer["method"] }
  for (const field of PLAN_FIELDS) if (Object.hasOwn(answer, field)) value[field] = answer[field]
  return value
}

/** The failure a handler's error maps to: its contract refusal, or `UNAVAILABLE` with a redacted line. */
function failureOf(entry: MethodEntry, error: unknown): Refusal {
  const own = refusalOf(error)
  if (own) return own
  return refusal("UNAVAILABLE", `${entry.name} failed: ${reasonOf(error)}`, "Try again; if it keeps failing, check the plugin's status.")
}

/** Run a prepared call's handler, checking its answer and mapping its failure. */
export async function execute(
  environment: CallEnvironment,
  entry: MethodEntry,
  prepared: PreparedCall,
  call: Omit<MethodCall, "account" | "plan" | "bus" | "unguardedAgents">,
  bus: BusReader,
): Promise<unknown> {
  if (prepared.reservation !== undefined) {
    const taken = environment.plans.consume(prepared.reservation)
    if (!taken.ok) throw new RegisterError(refusal(taken.code, taken.problems.join("; "), "Plan again, then commit with the new planId it answers."))
  }
  try {
    const value = checkedOutput(
      entry,
      await entry.handler.run(prepared.input, {
        ...call,
        account: prepared.account,
        ...(prepared.plan === undefined ? {} : { plan: prepared.plan }),
        bus: bus(),
        unguardedAgents: async () => {
          try {
            return { ok: true, agents: unguardedAgents(await environment.agents(), environment.access.rules) }
          } catch (error) {
            // The host's agent list is unknown, never empty: answer the redacted line and let status report it.
            return { ok: false, error: reasonOf(error) }
          }
        },
      }),
    )
    if (entry.item.plans === true) {
      const answer = value as Record<string, unknown>
      const recorded = environment.plans.record(answer, prepared.account, entry.commit ?? entry.name)
      if (!recorded.ok) {
        throw new RegisterError(refusal(recorded.code, recorded.problems.join("; "), "Answer a plan a copy can carry, at most 64 KB of JSON; preview everything the commit writes."))
      }
      return publicPlan(recorded.planId, answer)
    }
    return value
  } catch (error) {
    if (error instanceof RegisterError) throw error
    throw new RegisterError(failureOf(entry, error))
  }
}

/** The door's call context from an OpenCode tool context. */
export function toolCall(
  context: {
    readonly sessionID: string
    readonly agent: string
    readonly messageID: string
    readonly id: string
    readonly signal: AbortSignal
    readonly progress: (update: Readonly<Record<string, unknown>>) => Promise<void>
  },
  door: Exclude<Door, "rpc">,
): Omit<MethodCall, "account" | "plan" | "bus" | "unguardedAgents"> {
  return { sessionID: context.sessionID, agent: context.agent, messageID: context.messageID, id: context.id, signal: context.signal, progress: context.progress, door }
}
