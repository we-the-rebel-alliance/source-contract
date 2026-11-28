/**
 * The events every `register` call writes (principles rule 1.4, decision 0005; contract §19).
 *
 * One call through a door writes one event, before the door answers: `plugin.read` for a read, `plugin.plan` for a
 * planning call, `plugin.commit` for an act that ran, and `plugin.refused` for a call that did not return. The event
 * carries the method, its class and effect, the account, the consumer, how the call was allowed, its outcome and its
 * duration; a read also carries the events it returned and the provider's cost. It never carries a tool's input, its
 * answer, provider text or a credential.
 *
 * The log is local, append-only JSON Lines. The host may give its path as `register`'s `telemetry.path`; otherwise it is
 * under the plugin's data directory. A log that cannot be written is skipped, and the call's answer is unchanged.
 */
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"
import { secretKinds } from "../internal/secrets.ts"
import type { Manifest } from "../manifest.ts"
import { createEvent, createEventLog, type EventLog, type TelemetrySource } from "../telemetry.ts"
import type { Door, MethodEntry } from "./handlers.ts"

/**
 * How a call was allowed. `grant` is a host-signed action grant, `ask` is a permission ask that was answered, `rule` is
 * an access rule that needed no ask, and `none` is a call that no confirmation allowed (it was refused).
 */
export type AllowedBy = "grant" | "ask" | "rule" | "none"

/** The host's telemetry wiring: the log path, and the source's version and deployment when the host knows them. */
export interface TelemetryWiring {
  /** The JSON Lines log. Default: the plugin's data directory under the host's data root. */
  readonly path?: string | undefined
  /** The component version in the event's source. Default: `unknown`. */
  readonly version?: string | undefined
  /** The deployment in the event's source. Default: `local`. */
  readonly deployment?: string | undefined
}

/** What one call knows while it runs; its account and confirmation are filled once the register resolves them. */
export interface CallTrace {
  sessionID: string
  agent: string
  account: string
  consumer: string
  allowedBy: AllowedBy
}

/** One finished call, as the recorder takes it. */
export interface CallEvent {
  readonly entry: MethodEntry
  readonly door: Door
  readonly trace: CallTrace
  /** `ok`, or the contract code that refused the call. */
  readonly outcome: string
  readonly durationMs: number
  /** The call's answer, read for a read's count and cost and never written itself. */
  readonly value?: unknown
}

/** The recorder one registration holds. */
export interface RegisterTelemetry {
  record(event: CallEvent): void
}

/**
 * The log a plugin writes when the host gives no path: under the host's data root, in the plugin's own directory.
 * `XDG_DATA_HOME` is respected, as OpenCode respects it; otherwise the root is `~/.local/share`.
 */
export function defaultEventLogPath(name: string): string {
  const data = process.env["XDG_DATA_HOME"] || join(homedir(), ".local", "share")
  return join(data, "opencode", "plugin-data", name, "events.jsonl")
}

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A stable pseudonym for a session or an agent, so a raw id never reaches the log. */
function pseudonym(kind: "agent" | "session", value: string): string {
  const text = value.trim() === "" ? "unknown" : value
  return `${kind}_${createHash("sha256").update(`${kind}\u0000${text}`).digest("hex").slice(0, 32)}`
}

/** The most characters a caller-supplied name may take in an event. */
const SAFE_TEXT_MAX = 128

/** A bounded, plain value that carries no secret; a flagged value is replaced, so the call still writes an event. */
function safeText(value: string, fallback: string): string {
  const text = value.trim() === "" ? fallback : value
  if (secretKinds(text).length > 0) return "redacted"
  const plainText = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
  if (plainText === "") return fallback
  return plainText.length > SAFE_TEXT_MAX ? plainText.slice(0, SAFE_TEXT_MAX) : plainText
}

/** The count of events a read answered, or zero when its answer has no event list. */
function countOf(value: unknown): number {
  return plain(value) && Array.isArray(value["events"]) ? value["events"].length : 0
}

/** The provider's cost in US dollars, or undefined when the answer carries none. */
function costOf(value: unknown): number | undefined {
  if (!plain(value) || !plain(value["cost"])) return undefined
  const usd = value["cost"]["usd"]
  return typeof usd === "number" && Number.isFinite(usd) && usd >= 0 ? usd : undefined
}

/** The catalogue type of a successful call: a plan, a read, or the act a commit (or a direct non-read) ran. */
function successType(entry: MethodEntry): "plugin.read" | "plugin.plan" | "plugin.commit" {
  if (entry.item.plans === true) return "plugin.plan"
  return entry.item.class === "read" ? "plugin.read" : "plugin.commit"
}

/**
 * Build the recorder for one registration. It creates the log once; a path it cannot use leaves telemetry off, and no
 * call fails because of it.
 */
export function createRegisterTelemetry(manifest: Manifest, wiring: TelemetryWiring | undefined): RegisterTelemetry {
  const name = manifest.plugin.name
  const source: TelemetrySource = {
    component: name,
    version: safeText(wiring?.version ?? "", "unknown"),
    deployment: safeText(wiring?.deployment ?? "", "local"),
  }
  let log: EventLog | undefined
  try {
    log = createEventLog({ path: wiring?.path ?? defaultEventLogPath(name) })
  } catch {
    log = undefined
  }
  return {
    record(call) {
      if (log === undefined) return
      try {
        const type = call.outcome === "ok" ? successType(call.entry) : "plugin.refused"
        const fields: Record<string, unknown> = {
          method: call.entry.name,
          method_class: call.entry.item.class,
          effect: call.entry.item.effect ?? "none",
          account: safeText(call.trace.account, "default"),
          consumer: safeText(call.trace.consumer, "unknown"),
          allowed_by: call.trace.allowedBy,
          outcome: call.outcome,
          duration_ms: Math.max(0, Math.round(call.durationMs)),
        }
        if (type === "plugin.read") {
          fields["count"] = countOf(call.value)
          const cost = costOf(call.value)
          if (cost !== undefined) fields["cost_usd"] = cost
        }
        const event = createEvent({
          type,
          source,
          subject: { agent: pseudonym("agent", call.trace.agent), session: pseudonym("session", call.trace.sessionID) },
          fields,
        })
        log.append(event)
      } catch {
        // A malformed or secret-bearing event is not captured, and the call's answer is unchanged.
      }
    },
  }
}
