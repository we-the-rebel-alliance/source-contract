/**
 * `events`: the events_list source contract, as a library (design §2.1 and §2.3).
 *
 *   events_list({ source?, account?, scope?, cursor?, since?, limit? })
 *     → { source, account, owner, events, cursor, more, trust: "untrusted",
 *         scope?, refused?, failed?, gap?, cost?, plugin?, asOf? }
 *
 * This is contract 1, the family's `src/host/events-list.ts` (identical in github, granola, gws, history, linear,
 * plaud, slack, wisprflow and x; SHA-256 9d72fc8d…605e), extracted as a module, with the final design's page result
 * added **additively**: every field and kind contract 1 defines keeps its meaning, every contract 1 page is a valid
 * page here, and each addition is optional. `docs/events.md` maps each addition to the design and lists what still needs
 * a decision.
 *
 * A source plugin adds one read-only tool and tools-RPC method named `events_list`. It never writes, never asks and
 * never calls a model, so a scheduled check can run it with no one there. The rules, which `eventsListConformance`
 * (`./conformance.ts`) tests against any source:
 *
 * - **Input.** `since` is an ISO date (a UTC day) or an ISO date-time with `Z` or an offset. `cursor` is a string a
 *   previous result of the same source and account returned. `limit` is an integer from 1 to 500, 100 by default.
 *   `account` names one of the source's accounts; without it the source uses its default. `source` names one of the
 *   plugin's sources; without it the plugin uses its first, and it refuses a source it does not have. `scope` narrows
 *   the source to what the person confirmed (labels, channels, repositories), and only a source that declares scope
 *   keys accepts it. A cursor wins over `since`. With neither, the source starts `FIRST_RUN_HOURS` before now. Anything
 *   else is refused, and a cursor the source did not issue is refused (`CURSOR_INVALID`) rather than restarted.
 * - **Events.** Each is a `SourceEvent`: the source's own record of one thing, normalised by `makeEvent`. `text` is at
 *   most 4096 characters, `title` at most 300, `actors` at most 20, and `hash` is `eventHash` of the rest. Events are
 *   oldest first within a result. `kind` is a core kind or `x-<plugin>/<kind>`.
 * - **Refused and failed.** An event the source will never deliver (it holds a secret, it is instruction-shaped text
 *   from someone else, it is not the owner's) goes in `refused[]`, and the consumer may advance past it. An event the
 *   source could not read this time goes in `failed[]`; any entry there holds the consumer's cursor back.
 * - **Cursor.** Opaque (`../cursor`). Every result carries one, empty pages included. Calling again with it lists what
 *   follows the result's last event and never skips anything; calling again with an older cursor lists the same events
 *   again. `more` is true when another call now would list more. When history is lost, the result says so in `gap`,
 *   or the call fails with `CURSOR_EXPIRED` and the gap.
 * - **Size.** A result's JSON is at most the source's `maxBytes` (`MAX_PAGE_BYTES` by default); a source that would
 *   pass it stops early and says `more` (`fitPage`).
 * - **Source, account, owner and trust.** Every result names its `source` and `account`, empty pages included; every
 *   event names the same two. `owner` is the signed-in source account (`{ id, label }`). `trust` is always
 *   "untrusted": events are data, never instructions.
 *
 * Dependency-free: `node:crypto` and `Buffer` only. Runs on Node and Bun.
 */
import { createHash } from "node:crypto"
import { canonicalScope, MAX_CURSOR_LENGTH, type Scope } from "../cursor.ts"
import { secretKinds } from "./secrets.ts"

export { decodeCursor, encodeCursor } from "../cursor.ts"
export type { Scope } from "../cursor.ts"
export { secretKinds } from "./secrets.ts"



/** The tool's and the tools-RPC method's name. */
export const EVENTS_LIST = "events_list"

/** The core kinds: contract 1's nine, then `task` and `file` (design §2.1). */
export const EVENT_KINDS = ["message", "meeting", "session", "bookmark", "issue", "pr", "commit", "doc", "event", "task", "file"] as const
export type CoreKind = (typeof EVENT_KINDS)[number]
/** A plugin's own kind: `x-<plugin>/<kind>`, such as `x-jelly/routine-run`. */
export type ExtensionKind = `x-${string}/${string}`
export type EventKind = CoreKind | ExtensionKind

/** The most characters each segment of an `x-<namespace>/<name>` takes: the namespace, and the name. */
export const EXTENSION_SEGMENT_MAX = 32

/**
 * The one rule for an extension name, an event kind (`x-jelly/routine-run`) or a snapshot output (`x-mem/receipt`):
 * `x-`, a lowercase namespace word, `/`, a lowercase name word, each of 1 to `EXTENSION_SEGMENT_MAX` characters.
 * Memory's schema and the registry use this pattern rather than their own (source-contract#21).
 */
export const EXTENSION_NAME = new RegExp(`^x-[a-z][a-z0-9-]{0,${EXTENSION_SEGMENT_MAX - 1}}/[a-z][a-z0-9-]{0,${EXTENSION_SEGMENT_MAX - 1}}$`)

/** An extension kind: `EXTENSION_NAME`, the one rule for kinds and outputs. */
export const EXTENSION_KIND = EXTENSION_NAME

/** True for an extension name, a kind or an output, by `EXTENSION_NAME`. */
export const isExtensionName = (name: unknown): name is ExtensionKind => typeof name === "string" && EXTENSION_NAME.test(name)

/** True for a core kind, or an extension kind (`EXTENSION_NAME`). */
export const isEventKind = (kind: unknown): kind is EventKind =>
  typeof kind === "string" && ((EVENT_KINDS as readonly string[]).includes(kind) || isExtensionName(kind))

/** An extension kind's namespace: `jelly` in `x-jelly/routine-run`; undefined for a core kind or a malformed one. */
export function extensionNamespace(kind: string): string | undefined {
  return isEventKind(kind) && kind.startsWith("x-") ? kind.slice(2, kind.indexOf("/")) : undefined
}

/**
 * True for a core kind, or an extension kind in `namespace`: the first segment of the source's id (`jelly` for
 * `jelly.routine-runs`), as Memory's schema checks a descriptor's `reads` (decision D13, (b)). An extension kind of
 * another namespace is refused, so one plugin cannot speak in another's vocabulary.
 */
export function isEventKindIn(kind: unknown, namespace: string): kind is EventKind {
  if (!isEventKind(kind)) return false
  const own = extensionNamespace(kind)
  return own === undefined || own === namespace
}

/** The namespace of a source id: its first dotted segment (`gws` in `gws.gmail`). */
export const sourceNamespace = (sourceId: string): string => sourceId.split(".", 1)[0] ?? sourceId

/** The most characters each field takes, and the most items each list takes. */
export const EVENT_LIMITS = {
  source: 64,
  account: 128,
  externalId: 512,
  thread: 512,
  title: 300,
  text: 4096,
  url: 2048,
  actors: 20,
  actorRole: 32,
  actorId: 320,
  actorName: 200,
  labels: 20,
  label: 64,
  ownerId: 320,
  ownerLabel: 200,
  cursor: MAX_CURSOR_LENGTH,
  scopeKeys: 16,
  scopeKey: 64,
  scopeValues: 64,
  scopeValue: 256,
  refused: 500,
  failed: 500,
  detail: 200,
  costUnits: 8,
} as const

/** `limit`'s default and inclusive range. */
export const PAGE = { default: 100, min: 1, max: 500 } as const

/**
 * The most bytes of JSON one result holds when the source declares no `maxBytes`: 64 KB, the descriptor's default
 * `maxBytes` and the host's RPC cap (decision D10, (b); contract 1's cap was 900 000). A source that declares a larger
 * `maxBytes` (at most 1 MB) passes it to `fitPage`, and the conformance takes it.
 */
export const MAX_PAGE_BYTES = 65_536

/** The descriptor's `maxBytes`: its default and its ceiling (design §2.2). */
export const MAX_BYTES = { default: 65_536, max: 1_048_576 } as const

/** Where a listing starts when the call has neither cursor nor since: this many hours before now. */
export const FIRST_RUN_HOURS = 24

export const TRUST = "untrusted" as const

/** Someone or something an event involves. `id` is a stable, scheme-qualified id: `mailto:…`, `slack:U…`, `github:…`. */
export interface EventActor {
  readonly role: string
  readonly id: string
  readonly name?: string
}

/** One normalised event, as a source lists it. A consumer adds its own id. */
export interface SourceEvent {
  readonly source: string
  readonly account: string
  readonly external_id: string
  readonly kind: EventKind
  /** UTC, as `Date.prototype.toISOString` writes it. */
  readonly occurred_at: string
  readonly thread: string | null
  readonly actors: EventActor[]
  readonly title: string
  readonly text: string
  /** An https link to the thing in the source, or null when it has none. */
  readonly url: string | null
  readonly labels: string[]
  /** `sha256:<hex>` of every other field, from `eventHash`. */
  readonly hash: string
}

/** The signed-in source account. */
export interface EventsOwner {
  readonly id: string
  readonly label: string
}

// ── The page result's additions (design §2.1) ─────────────────────────────

/** Why an event is refused for good: instruction-shaped text from someone else, a secret, or not the owner's. */
export const REFUSAL_REASONS = ["instruction", "secret", "owner"] as const
export type RefusalReason = (typeof REFUSAL_REASONS)[number]

/** An event the source will never deliver. The consumer may advance its cursor past it. */
export interface RefusedEvent {
  readonly external_id: string
  readonly reason: RefusalReason
  /** One line, at most 200 characters, never the event's content: the secret kinds, for example. */
  readonly detail?: string
}

/** An event the source could not read this time. Any entry holds the consumer's cursor back. */
export interface FailedEvent {
  readonly external_id: string
  /** An error code (`RATE_LIMITED`, `UNAVAILABLE`, …). */
  readonly code: string
  readonly retryAfterSec?: number
}

/** Why history was lost: the provider expired it, or the source read only part of the window. */
export const GAP_REASONS = ["expired", "window-truncated"] as const
export type GapReason = (typeof GAP_REASONS)[number]

/** History is lost from `since` (UTC ISO) up to the page's first event. */
export interface EventsGap {
  readonly reason: GapReason
  readonly since: string
}

/** What the provider reported this call cost, for billed sources: counts per declared price unit, and US dollars. */
export interface EventsCost {
  readonly units: readonly { readonly per: string; readonly count: number }[]
  readonly usd?: number
}

export interface EventsListInput {
  readonly since?: string
  readonly cursor?: string
  readonly limit?: number
  readonly account?: string
  readonly source?: string
  readonly scope?: Scope
}

export interface EventsListResult {
  /** The source every event names, also on an empty page. */
  readonly source: string
  /** The account every event names, also on an empty page. */
  readonly account: string
  readonly owner: EventsOwner
  readonly events: SourceEvent[]
  readonly cursor: string
  readonly more: boolean
  readonly trust: typeof TRUST
  /** The scope the page was read under, canonical (`canonicalScope`); absent for the whole source. */
  readonly scope?: Record<string, string | string[]>
  readonly refused?: RefusedEvent[]
  readonly failed?: FailedEvent[]
  readonly gap?: EventsGap
  readonly cost?: EventsCost
  /** The plugin's package name or id (the draft's envelope). */
  readonly plugin?: string
  /** When the source read the page, UTC ISO (the draft's envelope). */
  readonly asOf?: string
}

/** An input after `parseEventsListInput`: `since` in epoch milliseconds, `limit` with its default, `scope` canonical. */
export interface EventsListRequest {
  readonly since?: number
  readonly cursor?: string
  readonly limit: number
  readonly account?: string
  readonly source?: string
  readonly scope?: Record<string, string | string[]>
}

// ── Errors (design §2.1, "Errors") ────────────────────────────────────────

/** The one error table: the draft's nine and the final design's three. */
export const ERROR_CODES = [
  "NEEDS_SIGN_IN",
  "ACCOUNT_MISMATCH",
  "CURSOR_INVALID",
  "CURSOR_EXPIRED",
  "RATE_LIMITED",
  "TOO_LARGE",
  "SCHEMA_VIOLATION",
  "PERMISSION_DENIED",
  "UNAVAILABLE",
  "SCOPE_MISSING",
  "BUDGET_EXCEEDED",
  "SOURCE_DISABLED",
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/**
 * Codes the nine plugins use today for refusals the table has no row for: a malformed input and a source the plugin
 * does not have. Proposed for the table (`docs/events.md`, decision D3); until decided, `canonicalCode` accepts them.
 */
export const PROPOSED_CODES = ["INPUT_INVALID", "SOURCE_UNKNOWN"] as const
export type ProposedCode = (typeof PROPOSED_CODES)[number]

/** Another name for a code in the table: `AUTH_REQUIRED` is `NEEDS_SIGN_IN` (design §2.1). */
export const ERROR_ALIASES: Readonly<Record<string, ErrorCode>> = { AUTH_REQUIRED: "NEEDS_SIGN_IN" }

/**
 * The codes contract 1's plugins use, mapped to the table, so a consumer can read a plugin that has not moved yet
 * (projects support the current and previous contract versions, design §3).
 */
export const CONTRACT1_CODES: Readonly<Record<string, ErrorCode | ProposedCode>> = {
  EVENTS_INVALID_INPUT: "INPUT_INVALID",
  EVENTS_CURSOR_INVALID: "CURSOR_INVALID",
  EVENTS_SOURCE_UNKNOWN: "SOURCE_UNKNOWN",
}

/** The table's code for `code`: itself, its alias, or contract 1's name for it; undefined for any other code. */
export function canonicalCode(code: string): ErrorCode | ProposedCode | undefined {
  if ((ERROR_CODES as readonly string[]).includes(code) || (PROPOSED_CODES as readonly string[]).includes(code)) return code as ErrorCode | ProposedCode
  return ERROR_ALIASES[code] ?? CONTRACT1_CODES[code]
}

/**
 * A refusal in the family's form, `CODE: what happened. Next step: what to do.`, with the code and its data. A
 * `RATE_LIMITED` or `BUDGET_EXCEEDED` may carry `retryAfterSec`; a `CURSOR_EXPIRED` carries the `gap`.
 */
export class SourceError extends Error {
  readonly code: string
  readonly what: string
  readonly next: string
  readonly retryAfterSec?: number
  readonly gap?: EventsGap
  constructor(init: { readonly code: string; readonly what: string; readonly next: string; readonly retryAfterSec?: number; readonly gap?: EventsGap }) {
    super(`${init.code}: ${init.what.replace(/[.\s]+$/, "")}. Next step: ${init.next}`)
    this.name = "SourceError"
    this.code = init.code
    this.what = init.what
    this.next = init.next
    if (init.retryAfterSec !== undefined) this.retryAfterSec = init.retryAfterSec
    if (init.gap !== undefined) this.gap = init.gap
  }
}

const FAMILY_MESSAGE = /^([A-Z][A-Z0-9_]*): ([^]*?)(?:\. Next step: ([^]*))?$/

/**
 * The code, its canonical code, what happened and the next step, read from a refusal: a `SourceError`, or any error
 * whose message is in the family's form. Undefined for an error with no code.
 */
export function parseSourceError(error: unknown): { code: string; canonical?: ErrorCode | ProposedCode; what: string; next?: string } | undefined {
  if (error instanceof SourceError) {
    const canonical = canonicalCode(error.code)
    return { code: error.code, ...(canonical ? { canonical } : {}), what: error.what, next: error.next }
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined
  const match = message === undefined ? null : FAMILY_MESSAGE.exec(message.split("\n", 1)[0] ?? "")
  if (!match) return undefined
  const canonical = canonicalCode(match[1]!)
  return { code: match[1]!, ...(canonical ? { canonical } : {}), what: match[2]!, ...(match[3] === undefined ? {} : { next: match[3] }) }
}

// ── Input ─────────────────────────────────────────────────────────────────

/** An ISO date (a UTC day), or an ISO date-time with seconds optional and `Z` or an offset. */
export const SINCE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/

/** A source's name: a lowercase word such as gmail or history. */
export const SOURCE_PATTERN = /^[a-z][a-z0-9-]*$/

/** A scope key: a word such as `label`, `channels` or `repositories`. */
export const SCOPE_KEY_PATTERN = /^[a-z][A-Za-z0-9_-]*$/

const INPUT_KEYS: readonly string[] = ["since", "cursor", "limit", "account", "source"]
/** True when the text has a control character (U+0000 to U+001F, or U+007F). */
const hasControl = (text: string) => [...text].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)

const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** `since` in epoch milliseconds; undefined when it is not one of the accepted forms or not a real time. */
export function sinceTime(since: string): number | undefined {
  if (!SINCE_PATTERN.test(since)) return undefined
  const time = Date.parse(since.length === 10 ? `${since}T00:00:00Z` : since)
  return Number.isFinite(time) ? time : undefined
}

const scopeValue = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length <= EVENT_LIMITS.scopeValue && !hasControl(value)

/** A scope's problems against the keys a source declares, one sentence each, naming keys and never values. */
export function scopeProblems(scope: unknown, keys: readonly string[]): string[] {
  if (!plainObject(scope)) return [`"scope" must be an object of the source's scope keys`]
  const problems: string[] = []
  const entries = Object.entries(scope)
  if (entries.length > EVENT_LIMITS.scopeKeys) problems.push(`"scope" has more than ${EVENT_LIMITS.scopeKeys} keys`)
  for (const [key, value] of entries) {
    if (!keys.includes(key)) {
      problems.push(SCOPE_KEY_PATTERN.test(key) && key.length <= EVENT_LIMITS.scopeKey ? `"scope.${key}" is not a scope key of this source` : `"scope" has a key that is not a scope key of this source`)
      continue
    }
    const ok = scopeValue(value) || (Array.isArray(value) && value.length <= EVENT_LIMITS.scopeValues && value.every(scopeValue))
    if (!ok) problems.push(`"scope.${key}" must be a value, or a list of at most ${EVENT_LIMITS.scopeValues} values, of at most ${EVENT_LIMITS.scopeValue} characters`)
  }
  return problems
}

/** How a source parses its input: the scope keys it declares (`scope.keys` in its descriptor), none by default. */
export interface ParseOptions {
  readonly scopeKeys?: readonly string[]
}

/**
 * The input checked and normalised, or the problems with it, one sentence each, naming fields and never values.
 * `scope` is accepted only when `options.scopeKeys` declares keys: a source that does not read a scope must refuse
 * one rather than ignore it, since ignoring it would read more than the consumer asked for.
 */
export function parseEventsListInput(input: unknown, options: ParseOptions = {}): { ok: true; value: EventsListRequest } | { ok: false; problems: string[] } {
  const value = input === undefined || input === null ? {} : input
  if (!plainObject(value)) return { ok: false, problems: ["the input must be an object"] }
  const scoped = (options.scopeKeys?.length ?? 0) > 0
  const known = scoped ? [...INPUT_KEYS, "scope"] : INPUT_KEYS
  const problems = Object.keys(value).filter((key) => !known.includes(key)).map((key) => `"${key}" is not an input of events_list`)
  const { since, cursor, limit, account, source, scope } = value
  let time: number | undefined
  if (since !== undefined) {
    time = typeof since === "string" ? sinceTime(since) : undefined
    if (time === undefined) problems.push(`"since" must be an ISO date, or an ISO date-time with Z or an offset`)
  }
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0 || cursor.length > EVENT_LIMITS.cursor)) {
    problems.push(`"cursor" must be a cursor from a previous result`)
  }
  if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < PAGE.min || limit > PAGE.max)) {
    problems.push(`"limit" must be an integer from ${PAGE.min} to ${PAGE.max}`)
  }
  if (account !== undefined && (typeof account !== "string" || account.length === 0 || account.length > EVENT_LIMITS.account || hasControl(account))) {
    problems.push(`"account" must be a non-empty account name of at most ${EVENT_LIMITS.account} characters`)
  }
  if (source !== undefined && (typeof source !== "string" || source.length > EVENT_LIMITS.source || !SOURCE_PATTERN.test(source))) {
    problems.push(`"source" must be a source's name, a lowercase word such as gmail`)
  }
  if (scoped && scope !== undefined) problems.push(...scopeProblems(scope, options.scopeKeys!))
  if (problems.length > 0) return { ok: false, problems }
  return {
    ok: true,
    value: {
      ...(time === undefined ? {} : { since: time }),
      ...(cursor === undefined ? {} : { cursor: cursor as string }),
      limit: (limit as number | undefined) ?? PAGE.default,
      ...(account === undefined ? {} : { account: account as string }),
      ...(source === undefined ? {} : { source: source as string }),
      ...(scoped && scope !== undefined ? { scope: canonicalScope(scope as Scope) } : {}),
    },
  }
}

/** Where a listing without a cursor starts: `since`, or `FIRST_RUN_HOURS` before `now`. */
export function startTime(request: Pick<EventsListRequest, "since">, now: number): number {
  return request.since ?? now - FIRST_RUN_HOURS * 3_600_000
}

// ── Events ────────────────────────────────────────────────────────────────

/** At most `max` characters, ending in `…` when cut, never splitting a surrogate pair. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text
  let end = Math.max(0, max - 1)
  const code = text.charCodeAt(end - 1)
  if (end > 0 && code >= 0xd800 && code <= 0xdbff) end--
  return `${text.slice(0, end)}…`
}

/** `sha256:` and the hex digest of every field but the hash, in a fixed order. */
export function eventHash(event: Omit<SourceEvent, "hash">): string {
  const fields = [
    event.source,
    event.account,
    event.external_id,
    event.kind,
    event.occurred_at,
    event.thread,
    event.actors.map((actor) => [actor.role, actor.id, actor.name ?? null]),
    event.title,
    event.text,
    event.url,
    event.labels,
  ]
  return `sha256:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`
}

/** What a source fills in for `makeEvent`; it normalises the rest. */
export interface EventDraft {
  readonly source: string
  readonly account: string
  readonly external_id: string
  readonly kind: EventKind
  /** A Date, epoch milliseconds, or a string `Date.parse` reads. */
  readonly occurred_at: Date | number | string
  readonly thread?: string | null
  readonly actors?: readonly { readonly role: string; readonly id: string; readonly name?: string | null }[]
  readonly title?: string | null
  readonly text?: string | null
  readonly url?: string | null
  readonly labels?: readonly string[]
}

const clean = (text: string) => text.replaceAll("\u0000", "")
const oneLine = (text: string) => clean(text).replace(/\s+/g, " ").trim()

/**
 * A `SourceEvent` from a draft: the time in UTC ISO form, the title on one line and cut to 300 characters, the text cut
 * to 4096, actors without blanks or repeats and at most 20, labels likewise, a url only when it is https, and the hash.
 * Throws when the time is not a real time.
 */
export function makeEvent(draft: EventDraft): SourceEvent {
  const time = draft.occurred_at instanceof Date ? draft.occurred_at.getTime() : typeof draft.occurred_at === "number" ? draft.occurred_at : Date.parse(draft.occurred_at)
  if (!Number.isFinite(time)) throw new Error("events-list: an event's occurred_at is not a time")
  const seen = new Set<string>()
  const actors: EventActor[] = []
  for (const actor of draft.actors ?? []) {
    const role = oneLine(actor.role).toLowerCase()
    const id = oneLine(actor.id)
    const key = `${role}\u0000${id}`
    if (!role || !id || seen.has(key) || actors.length >= EVENT_LIMITS.actors) continue
    seen.add(key)
    const name = actor.name ? cut(oneLine(actor.name), EVENT_LIMITS.actorName) : ""
    actors.push(name ? { role, id, name } : { role, id })
  }
  const labels = [...new Set((draft.labels ?? []).map((label) => oneLine(label).replace(/\s/g, "-")).filter((label) => label.length > 0 && label.length <= EVENT_LIMITS.label))].slice(0, EVENT_LIMITS.labels)
  const url = draft.url && /^https:\/\/\S+$/.test(draft.url) && draft.url.length <= EVENT_LIMITS.url ? draft.url : null
  const thread = draft.thread ? oneLine(draft.thread) || null : null
  const event = {
    source: draft.source,
    account: draft.account,
    external_id: draft.external_id,
    kind: draft.kind,
    occurred_at: new Date(time).toISOString(),
    thread,
    actors,
    title: cut(oneLine(draft.title ?? ""), EVENT_LIMITS.title),
    text: cut(clean(draft.text ?? "").trim(), EVENT_LIMITS.text),
    url,
    labels,
  }
  return { ...event, hash: eventHash(event) }
}

/** Events oldest first; events at the same time keep their order. */
export function oldestFirst<T extends Pick<SourceEvent, "occurred_at">>(events: readonly T[]): T[] {
  return events
    .map((event, index) => ({ event, index, time: Date.parse(event.occurred_at) }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ event }) => event)
}

/**
 * How many of `events`, in the order given, fit in one result: at most `limit`, and as many as keep the result's JSON
 * within `maxBytes` (`MAX_PAGE_BYTES` by default; pass the descriptor's `maxBytes`), but always at least one.
 */
export function fitPage(events: readonly SourceEvent[], limit: number, maxBytes: number = MAX_PAGE_BYTES): number {
  let bytes = 2_048
  let count = 0
  for (const event of events) {
    if (count >= limit) break
    bytes += Buffer.byteLength(JSON.stringify(event)) + 1
    if (count > 0 && bytes > maxBytes) break
    count++
  }
  return count
}

// ── Refusal: the secret pattern, and the source's own predicates ──────────

/** How `screenEvents` decides. Without predicates, only the secret pattern refuses. */
export interface ScreenOptions {
  /** False when the event is not the signed-in owner's (a shared mailbox, a delegated calendar). */
  readonly ownedBy?: (event: SourceEvent) => boolean
  /** True when the event is instruction-shaped text from someone else. The library has no default (`docs/events.md`, D5). */
  readonly instruction?: (event: SourceEvent) => boolean
  /** The secret detector; Memory's `secretKinds` by default. */
  readonly secrets?: (text: string) => readonly string[]
}

/**
 * The events a page may carry, and those it refuses for good, in order: not the owner's, then a secret in the title or
 * text (as Memory's store checks an import), then instruction-shaped. A refusal's detail never holds the content.
 */
export function screenEvents(events: readonly SourceEvent[], options: ScreenOptions = {}): { events: SourceEvent[]; refused: RefusedEvent[] } {
  const detect = options.secrets ?? secretKinds
  const kept: SourceEvent[] = []
  const refused: RefusedEvent[] = []
  for (const event of events) {
    if (options.ownedBy && !options.ownedBy(event)) {
      refused.push({ external_id: event.external_id, reason: "owner" })
      continue
    }
    const kinds = detect([event.title, event.text].filter(Boolean).join("\n"))
    if (kinds.length > 0) {
      refused.push({ external_id: event.external_id, reason: "secret", detail: cut(`holds a secret (${kinds.join(", ")})`, EVENT_LIMITS.detail) })
      continue
    }
    if (options.instruction?.(event)) {
      refused.push({ external_id: event.external_id, reason: "instruction" })
      continue
    }
    kept.push(event)
  }
  return { events: kept, refused }
}

// ── Probe (design §2.3; source-contract#8 and #4) ───────────────────────────

/** The tools-RPC method and tool every source plugin names `probe`: one per plugin, called per source. */
export const PROBE = "probe"

/** `probe`'s input: the source (the plugin's first without it) and the account (its default without it). Nothing else. */
export interface ProbeInput {
  readonly source?: string
  readonly account?: string
}

/** The provider sign-in scopes a probe may list: at most this many, each at most this long. */
export const PROBE_LIMITS = { scopes: 64, scope: 256 } as const

/**
 * What `probe` answers: whose the source is and what its sign-in holds, and nothing it reads. `owner.id` is the id a
 * host keys its cache on and `$me` resolves to. `scopes` are the provider sign-in's scopes, so a Calendar-only sign-in
 * can be told apart. `cost` is what the provider charged for the probe, for a billed source such as X (its own price
 * table, per §2.2 `cost.probe`). `trust` is "untrusted", as on every result.
 */
export interface ProbeResult {
  readonly source: string
  readonly account: string
  readonly owner: EventsOwner
  readonly scopes?: string[]
  readonly cost?: EventsCost
  readonly trust: typeof TRUST
}

/** `probe`'s input checked, or its problems, naming fields and never values. Anything but source and account is refused. */
export function parseProbeInput(input: unknown): { ok: true; value: ProbeInput } | { ok: false; problems: string[] } {
  const value = input === undefined || input === null ? {} : input
  if (!plainObject(value)) return { ok: false, problems: ["the input must be an object"] }
  const problems = Object.keys(value).filter((key) => key !== "source" && key !== "account").map((key) => `"${key}" is not an input of probe`)
  const { source, account } = value
  if (source !== undefined && (typeof source !== "string" || source.length > EVENT_LIMITS.source || !SOURCE_PATTERN.test(source))) {
    problems.push(`"source" must be a source's name, a lowercase word such as gmail`)
  }
  if (account !== undefined && (typeof account !== "string" || account.length === 0 || account.length > EVENT_LIMITS.account || hasControl(account))) {
    problems.push(`"account" must be a non-empty account name of at most ${EVENT_LIMITS.account} characters`)
  }
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, value: { ...(source === undefined ? {} : { source: source as string }), ...(account === undefined ? {} : { account: account as string }) } }
}

/** A probe answer for `identity`, with the sign-in's scopes and the probe's cost when given. */
export function probeResult(identity: EventsListIdentity, extras: { readonly scopes?: readonly string[]; readonly cost?: EventsCost } = {}): ProbeResult {
  return {
    source: identity.source,
    account: identity.account,
    owner: { id: identity.owner.id, label: identity.owner.label },
    ...(extras.scopes === undefined ? {} : { scopes: [...new Set(extras.scopes)] }),
    ...(extras.cost === undefined ? {} : { cost: extras.cost }),
    trust: TRUST,
  }
}

const PROBE_KEYS: readonly string[] = ["source", "account", "owner", "scopes", "cost", "trust"]

/**
 * A probe answer's problems, one sentence each; none when it keeps the contract. Its keys are exactly
 * `source, account, owner, scopes?, cost?, trust`, so a probe that returned content (events, data, text) fails. With
 * `expected`, the source and the account must be the ones asked for.
 */
export function probeResultProblems(result: unknown, expected: { readonly source?: string; readonly account?: string } = {}): string[] {
  if (!plainObject(result)) return ["the probe answer is not an object"]
  const problems: string[] = []
  for (const key of Object.keys(result)) if (!PROBE_KEYS.includes(key)) problems.push(`the probe answer has the field "${key}": a probe reads no content, and the contract defines no such field`)
  if (!line(result["source"], EVENT_LIMITS.source) || !SOURCE_PATTERN.test(result["source"])) problems.push("the probe answer's source must be a lowercase name such as gmail")
  else if (expected.source !== undefined && result["source"] !== expected.source) problems.push(`the probe answer names the source ${result["source"]}, not ${expected.source}`)
  if (!line(result["account"], EVENT_LIMITS.account)) problems.push(`the probe answer's account must be a non-empty name of at most ${EVENT_LIMITS.account} characters`)
  else if (expected.account !== undefined && result["account"] !== expected.account) problems.push("the probe answer names another account than the one asked for")
  const owner = result["owner"]
  if (!plainObject(owner) || !line(owner["id"], EVENT_LIMITS.ownerId) || !line(owner["label"], EVENT_LIMITS.ownerLabel) || Object.keys(owner).some((key) => key !== "id" && key !== "label")) {
    problems.push("the probe answer's owner must be { id, label }, two non-empty lines")
  }
  const scopes = result["scopes"]
  if (scopes !== undefined && (!Array.isArray(scopes) || scopes.length > PROBE_LIMITS.scopes || scopes.some((scope) => !line(scope, PROBE_LIMITS.scope)) || new Set(scopes).size !== scopes.length)) {
    problems.push(`the probe answer's scopes must be at most ${PROBE_LIMITS.scopes} different lines of at most ${PROBE_LIMITS.scope} characters`)
  }
  if (result["cost"] !== undefined) problems.push(...extraProblems({ cost: result["cost"] }, new Set()).map((problem) => problem.replace("the result's cost", "the probe answer's cost")))
  if (result["trust"] !== TRUST) problems.push(`the probe answer's trust must be "${TRUST}"`)
  return problems
}

// ── Results ───────────────────────────────────────────────────────────────

/** Whose a result is: the source and account it lists, and the signed-in owner of that account. */
export interface EventsListIdentity {
  readonly source: string
  readonly account: string
  readonly owner: EventsOwner
}

/** The page result's optional parts; each is written only when given. Empty `refused` and `failed` lists are left out. */
export interface PageExtras {
  readonly scope?: Scope
  readonly refused?: readonly RefusedEvent[]
  readonly failed?: readonly FailedEvent[]
  readonly gap?: EventsGap
  readonly cost?: EventsCost
  readonly plugin?: string
  readonly asOf?: string
}

/** A result, with its source, account, owner and trust marker, and the extras given. Without extras, contract 1's. */
export function eventsListResult(identity: EventsListIdentity, events: readonly SourceEvent[], cursor: string, more: boolean, extras: PageExtras = {}): EventsListResult {
  return {
    source: identity.source,
    account: identity.account,
    owner: identity.owner,
    events: [...events],
    cursor,
    more,
    trust: TRUST,
    ...(extras.scope === undefined ? {} : { scope: canonicalScope(extras.scope) }),
    ...(extras.refused && extras.refused.length > 0 ? { refused: [...extras.refused] } : {}),
    ...(extras.failed && extras.failed.length > 0 ? { failed: [...extras.failed] } : {}),
    ...(extras.gap === undefined ? {} : { gap: extras.gap }),
    ...(extras.cost === undefined ? {} : { cost: extras.cost }),
    ...(extras.plugin === undefined ? {} : { plugin: extras.plugin }),
    ...(extras.asOf === undefined ? {} : { asOf: extras.asOf }),
  }
}

// ── Checks ────────────────────────────────────────────────────────────────

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const ROLE = /^[a-z][a-z0-9_-]*$/
const SCHEMED = /^[a-z][a-z0-9+.-]*:\S+$/
const HASH = /^sha256:[0-9a-f]{64}$/
const CODE = /^[A-Z][A-Z0-9_]*$/
const UNIT = /^[a-z][a-z0-9_-]*$/

const text = (value: unknown, max: number, empty = false): value is string =>
  typeof value === "string" && value.length <= max && (empty || value.length > 0) && !value.includes("\u0000")
const line = (value: unknown, max: number, empty = false): value is string => text(value, max, empty) && !hasControl(value)
const isoUtc = (value: unknown): value is string => typeof value === "string" && ISO_UTC.test(value) && Number.isFinite(Date.parse(value))

/** One event's problems, one sentence each; none when it keeps the contract. */
export function eventProblems(event: unknown, where = "event"): string[] {
  if (!plainObject(event)) return [`${where} is not an object`]
  const problems: string[] = []
  const keys = ["source", "account", "external_id", "kind", "occurred_at", "thread", "actors", "title", "text", "url", "labels", "hash"]
  for (const key of Object.keys(event)) if (!keys.includes(key)) problems.push(`${where} has the field "${key}", which the contract does not define`)
  for (const key of keys) if (!Object.hasOwn(event, key)) problems.push(`${where} has no "${key}"`)
  const e = event as Record<string, unknown>
  if (!line(e.source, EVENT_LIMITS.source) || !SOURCE_PATTERN.test(e.source)) problems.push(`${where}.source must be a lowercase name such as gmail`)
  if (!line(e.account, EVENT_LIMITS.account)) problems.push(`${where}.account must be a non-empty name of at most ${EVENT_LIMITS.account} characters`)
  if (!line(e.external_id, EVENT_LIMITS.externalId)) problems.push(`${where}.external_id must be a non-empty id of at most ${EVENT_LIMITS.externalId} characters`)
  if (!isEventKind(e.kind)) problems.push(`${where}.kind must be one of ${EVENT_KINDS.join(", ")}, or x-<plugin>/<kind>`)
  if (!isoUtc(e.occurred_at)) problems.push(`${where}.occurred_at must be a UTC ISO date-time ending in Z`)
  if (e.thread !== null && !line(e.thread, EVENT_LIMITS.thread)) problems.push(`${where}.thread must be null or a non-empty id of at most ${EVENT_LIMITS.thread} characters`)
  if (!line(e.title, EVENT_LIMITS.title, true)) problems.push(`${where}.title must be one line of at most ${EVENT_LIMITS.title} characters`)
  if (!text(e.text, EVENT_LIMITS.text, true)) problems.push(`${where}.text must be at most ${EVENT_LIMITS.text} characters`)
  if (e.url !== null && (typeof e.url !== "string" || e.url.length > EVENT_LIMITS.url || !/^https:\/\/\S+$/.test(e.url))) problems.push(`${where}.url must be null or an https URL`)
  if (!Array.isArray(e.labels) || e.labels.length > EVENT_LIMITS.labels || e.labels.some((label) => !line(label, EVENT_LIMITS.label) || /\s/.test(label))) {
    problems.push(`${where}.labels must be at most ${EVENT_LIMITS.labels} labels of at most ${EVENT_LIMITS.label} characters without spaces`)
  } else if (new Set(e.labels).size !== e.labels.length) problems.push(`${where}.labels repeats a label`)
  if (!Array.isArray(e.actors) || e.actors.length > EVENT_LIMITS.actors) problems.push(`${where}.actors must be a list of at most ${EVENT_LIMITS.actors}`)
  else {
    const seen = new Set<string>()
    for (const [index, actor] of (e.actors as unknown[]).entries()) {
      const at = `${where}.actors[${index}]`
      if (!plainObject(actor)) {
        problems.push(`${at} is not an object`)
        continue
      }
      for (const key of Object.keys(actor)) if (!["role", "id", "name"].includes(key)) problems.push(`${at} has the field "${key}", which the contract does not define`)
      if (!line(actor.role, EVENT_LIMITS.actorRole) || !ROLE.test(actor.role)) problems.push(`${at}.role must be a lowercase word such as from`)
      if (!line(actor.id, EVENT_LIMITS.actorId) || !SCHEMED.test(actor.id)) problems.push(`${at}.id must be a scheme-qualified id such as mailto:someone@example.com`)
      if (actor.name !== undefined && !line(actor.name, EVENT_LIMITS.actorName)) problems.push(`${at}.name must be one non-empty line of at most ${EVENT_LIMITS.actorName} characters`)
      const key = `${String(actor.role)}\u0000${String(actor.id)}`
      if (seen.has(key)) problems.push(`${at} repeats an actor`)
      seen.add(key)
    }
  }
  if (typeof e.hash !== "string" || !HASH.test(e.hash)) problems.push(`${where}.hash must be sha256: and 64 hex digits`)
  else if (problems.length === 0) {
    const { hash, ...rest } = e as unknown as SourceEvent
    if (eventHash(rest) !== hash) problems.push(`${where}.hash is not the eventHash of its fields`)
  }
  return problems
}

/** The fields contract 1 defines, then the optional ones the final page result adds. */
const RESULT_KEYS: readonly string[] = ["source", "account", "owner", "events", "cursor", "more", "trust"]
const EXTRA_KEYS: readonly string[] = ["scope", "refused", "failed", "gap", "cost", "plugin", "asOf"]

/** The additions' problems: `scope`, `refused`, `failed`, `gap`, `cost`, `plugin` and `asOf`, each when present. */
function extraProblems(result: Record<string, unknown>, ids: ReadonlySet<string>): string[] {
  const problems: string[] = []
  if (result["scope"] !== undefined) {
    const scope = result["scope"]
    let canonical = false
    try {
      canonical = plainObject(scope) && JSON.stringify(canonicalScope(scope as Scope)) === JSON.stringify(scope)
    } catch {
      canonical = false
    }
    if (!canonical || scopeProblems(scope, Object.keys(scope as object)).length > 0) problems.push("the result's scope must be a scope in canonical form: keys sorted, each list sorted without repeats")
  }
  const entries = (name: "refused" | "failed", max: number, check: (entry: Record<string, unknown>, at: string) => string[]) => {
    const list = result[name]
    if (list === undefined) return
    if (!Array.isArray(list) || list.length > max) {
      problems.push(`the result's ${name} must be a list of at most ${max}`)
      return
    }
    for (const [index, entry] of list.entries()) {
      const at = `${name}[${index}]`
      if (!plainObject(entry)) {
        problems.push(`${at} is not an object`)
        continue
      }
      if (!line(entry["external_id"], EVENT_LIMITS.externalId)) problems.push(`${at}.external_id must be a non-empty id of at most ${EVENT_LIMITS.externalId} characters`)
      else if (ids.has(entry["external_id"])) problems.push(`${at} is also among the result's events`)
      problems.push(...check(entry, at))
    }
  }
  entries("refused", EVENT_LIMITS.refused, (entry, at) => [
    ...Object.keys(entry).filter((key) => !["external_id", "reason", "detail"].includes(key)).map((key) => `${at} has the field "${key}", which the contract does not define`),
    ...((REFUSAL_REASONS as readonly unknown[]).includes(entry["reason"]) ? [] : [`${at}.reason must be one of ${REFUSAL_REASONS.join(", ")}`]),
    ...(entry["detail"] === undefined || line(entry["detail"], EVENT_LIMITS.detail) ? [] : [`${at}.detail must be one line of at most ${EVENT_LIMITS.detail} characters`]),
  ])
  entries("failed", EVENT_LIMITS.failed, (entry, at) => [
    ...Object.keys(entry).filter((key) => !["external_id", "code", "retryAfterSec"].includes(key)).map((key) => `${at} has the field "${key}", which the contract does not define`),
    ...(typeof entry["code"] === "string" && CODE.test(entry["code"]) ? [] : [`${at}.code must be an error code such as RATE_LIMITED`]),
    ...(entry["retryAfterSec"] === undefined || (typeof entry["retryAfterSec"] === "number" && Number.isInteger(entry["retryAfterSec"]) && entry["retryAfterSec"] >= 0)
      ? []
      : [`${at}.retryAfterSec must be a whole number of seconds`]),
  ])
  for (const name of ["refused", "failed"] as const) {
    const list = result[name]
    if (Array.isArray(list)) {
      const listed = list.map((entry) => (plainObject(entry) ? entry["external_id"] : undefined))
      if (new Set(listed).size !== listed.length) problems.push(`the result's ${name} lists one event twice`)
    }
  }
  if (Array.isArray(result["refused"]) && Array.isArray(result["failed"])) {
    const refused = new Set((result["refused"] as unknown[]).map((entry) => (plainObject(entry) ? entry["external_id"] : undefined)))
    if ((result["failed"] as unknown[]).some((entry) => plainObject(entry) && refused.has(entry["external_id"]))) problems.push("an event is both refused and failed")
  }
  if (result["gap"] !== undefined) {
    const gap = result["gap"]
    if (!plainObject(gap) || Object.keys(gap).some((key) => key !== "reason" && key !== "since") || !(GAP_REASONS as readonly unknown[]).includes(gap["reason"]) || !isoUtc(gap["since"])) {
      problems.push(`the result's gap must be { reason: ${GAP_REASONS.join(" or ")}, since: a UTC ISO date-time }`)
    }
  }
  if (result["cost"] !== undefined) {
    const cost = result["cost"]
    const units = plainObject(cost) ? cost["units"] : undefined
    const unitsOk =
      Array.isArray(units) &&
      units.length <= EVENT_LIMITS.costUnits &&
      units.every((unit) => plainObject(unit) && Object.keys(unit).every((key) => key === "per" || key === "count") && typeof unit["per"] === "string" && UNIT.test(unit["per"]) && typeof unit["count"] === "number" && Number.isInteger(unit["count"]) && unit["count"] >= 0)
    const usd = plainObject(cost) ? cost["usd"] : undefined
    const usdOk = usd === undefined || (typeof usd === "number" && Number.isFinite(usd) && usd >= 0)
    if (!plainObject(cost) || Object.keys(cost).some((key) => key !== "units" && key !== "usd") || !unitsOk || !usdOk) {
      problems.push("the result's cost must be { units: [{ per, count }], usd? }, with whole counts and a non-negative usd")
    }
  }
  if (result["plugin"] !== undefined && !line(result["plugin"], 214)) problems.push("the result's plugin must be the plugin's package name or id")
  if (result["asOf"] !== undefined && !isoUtc(result["asOf"])) problems.push("the result's asOf must be a UTC ISO date-time ending in Z")
  return problems
}

/**
 * A result's problems: its shape, every event, the order, the limit and the size, and each optional addition that is
 * present. None when it keeps the contract. `maxBytes` is the source's declared cap, `MAX_PAGE_BYTES` by default.
 */
export function resultProblems(result: unknown, limit: number = PAGE.max, maxBytes: number = MAX_PAGE_BYTES): string[] {
  if (!plainObject(result)) return ["the result is not an object"]
  const problems: string[] = []
  for (const key of Object.keys(result)) if (!RESULT_KEYS.includes(key) && !EXTRA_KEYS.includes(key)) problems.push(`the result has the field "${key}", which the contract does not define`)
  const { source, account } = result
  const named = line(source, EVENT_LIMITS.source) && SOURCE_PATTERN.test(source)
  if (!named) problems.push("the result's source must be a lowercase name such as gmail")
  if (!line(account, EVENT_LIMITS.account)) problems.push(`the result's account must be a non-empty name of at most ${EVENT_LIMITS.account} characters`)
  const owner = result["owner"]
  if (!plainObject(owner) || !line(owner["id"], EVENT_LIMITS.ownerId) || !line(owner["label"], EVENT_LIMITS.ownerLabel) || Object.keys(owner).some((key) => key !== "id" && key !== "label")) {
    problems.push("the result's owner must be { id, label }, two non-empty lines")
  }
  const cursor = result["cursor"]
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > EVENT_LIMITS.cursor) problems.push(`the result's cursor must be a non-empty string of at most ${EVENT_LIMITS.cursor} characters`)
  if (typeof result["more"] !== "boolean") problems.push("the result's more must be true or false")
  if (result["trust"] !== TRUST) problems.push(`the result's trust must be "${TRUST}"`)
  const events = result["events"]
  if (!Array.isArray(events)) return [...problems, "the result's events must be a list"]
  if (events.length > limit) problems.push(`the result has ${events.length} events, over the limit of ${limit}`)
  for (const [index, event] of events.entries()) {
    problems.push(...eventProblems(event, `events[${index}]`))
    if (plainObject(event) && named && event["source"] !== source) problems.push(`events[${index}] names another source than the result`)
    if (plainObject(event) && typeof account === "string" && event["account"] !== account) problems.push(`events[${index}] names another account than the result`)
  }
  const times = events.map((event) => Date.parse(plainObject(event) ? String(event["occurred_at"]) : ""))
  if (times.some((time, index) => index > 0 && time < times[index - 1]!)) problems.push("the result's events are not oldest first")
  const ids = events.map((event) => (plainObject(event) ? `${String(event["source"])}:${String(event["account"])}:${String(event["external_id"])}` : ""))
  if (new Set(ids).size !== ids.length) problems.push("the result lists one event twice")
  problems.push(...extraProblems(result, new Set(events.map((event) => (plainObject(event) ? String(event["external_id"]) : "")))))
  const bytes = Buffer.byteLength(JSON.stringify(result))
  if (bytes > maxBytes) problems.push(`the result is ${bytes} bytes of JSON, over ${maxBytes}`)
  return problems
}
