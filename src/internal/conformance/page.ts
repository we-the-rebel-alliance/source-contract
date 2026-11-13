/**
 * The page result of `events_list`, contract version 1 (§2.1). The kit validates what a source answers; it does not
 * define a type for it, because the page is the `events` module's.
 *
 * A page carries the envelope (`source`, `plugin`, `account`, `owner`, `asOf`, `trust`), `events`, `cursor` and `more`,
 * then `refused[]` (final drops a consumer may advance past), `failed[]` (retryable drops, which hold the cursor back),
 * `gap` when history was lost, and `cost` for a billed source.
 *
 * `pageChecks` returns the problems by concern, so the kit can name each one; `pageProblems` is their sum.
 */
import type { SourceItem } from "../schema/types.ts"
import { CORE_KINDS } from "./rules.ts"

/** What a page is checked against. */
export interface PageOptions {
  readonly source: SourceItem
  /** The plugin's package name, which every result names. */
  readonly plugin: string
  /** The input the call was made with, so `failed[]` can be held against the cursor it must not advance. */
  readonly input: Readonly<Record<string, unknown>>
}

/** The page's problems, by concern. */
export interface PageChecks {
  /** The envelope, the events and their fields. */
  readonly shape: readonly string[]
  /** `failed[]` holds the cursor back, and an empty page still carries one. */
  readonly cursor: readonly string[]
  /** `gap` is shaped, and its window runs forwards. */
  readonly gap: readonly string[]
  /** A refused id is never also an event: a refusal is final. */
  readonly refused: readonly string[]
  /** `cost` is reported by a billed source. */
  readonly cost: readonly string[]
}

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** An ISO date-time with an offset, as §2.1 requires of `occurred_at` and `asOf`. */
export const instant = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)

const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max
const X_KIND = /^x-[a-z][a-z0-9-]*\/[a-z][a-z0-9-]{0,31}$/

/**
 * The page's problems, by concern.
 *
 * The Memory additions this enforces: `failed[]` holds the cursor back (a page with a retryable drop answers the cursor
 * it was called with, never a later one), and `refused[]` is final (a refused id is not also an event).
 */
export function pageChecks(answer: unknown, options: PageOptions): PageChecks {
  const shape: string[] = []
  const cursor: string[] = []
  const gap: string[] = []
  const refused: string[] = []
  const cost: string[] = []
  const where = "the page"
  const none: PageChecks = { shape: ["the page is not an object"], cursor: [], gap: [], refused: [], cost: [] }
  if (!plain(answer)) return none

  if (answer["source"] !== options.source.id) shape.push(`${where} names source ${JSON.stringify(answer["source"])}, not ${options.source.id}`)
  if (answer["plugin"] !== options.plugin) shape.push(`${where} names plugin ${JSON.stringify(answer["plugin"])}, not ${options.plugin}`)
  if (typeof answer["account"] !== "string" || answer["account"].length === 0) shape.push(`${where} has no account: every result names one, default included`)
  if (!instant(answer["asOf"])) shape.push(`${where} asOf must be an ISO date-time with an offset`)
  if (answer["trust"] !== "untrusted") shape.push(`${where} trust must be "untrusted": every field is external text`)

  const owner = answer["owner"]
  if (owner === null) {
    // No owner is a legitimate answer for a source that cannot name one.
  } else if (owner === undefined) {
    shape.push(`${where} owner must be null or { id, label? }`)
  } else if (!plain(owner) || typeof owner["id"] !== "string" || owner["id"].length === 0) {
    shape.push(`${where} owner must be null or { id, label? }`)
  } else if (owner["label"] !== undefined && typeof owner["label"] !== "string") {
    shape.push(`${where} owner.label must be a string when present`)
  }

  if (typeof answer["cursor"] !== "string") shape.push(`${where} cursor must be a string`)
  else if (answer["cursor"].length > 1024) shape.push(`${where} cursor is longer than 1024 characters`)
  if (typeof answer["more"] !== "boolean") shape.push(`${where} more must be true or false`)

  const events = answer["events"]
  if (!Array.isArray(events)) shape.push(`${where} events must be a list`)
  const refusedEntries = entries(answer["refused"], `${where} refused`, shape)
  const failed = entries(answer["failed"], `${where} failed`, shape)
  gapChecks(answer["gap"], where, gap)
  costChecks(answer["cost"], options.source, where, cost)

  const seen = new Set<string>()
  for (const [index, event] of (Array.isArray(events) ? events : []).entries()) {
    validateEvent(event, `${where} events[${index}]`, shape, seen)
  }
  const refusedIds = new Set(refusedEntries.map((entry) => entry.external_id))
  for (const id of seen) {
    if (refusedIds.has(id)) refused.push(`${where} lists ${id} as an event and in refused[]: a refusal is final`)
  }

  if (failed.length > 0) {
    const held = typeof options.input["cursor"] === "string" ? options.input["cursor"] : ""
    if (answer["cursor"] !== held) {
      cursor.push(`${where} failed[] holds the cursor back, and this page answered ${JSON.stringify(answer["cursor"])} instead of ${JSON.stringify(held)}`)
    }
  }
  if (Array.isArray(events) && events.length === 0 && answer["more"] === false && answer["cursor"] === "") {
    cursor.push(`${where} is empty and carries no cursor: a later call must be able to resume`)
  }
  return { shape, cursor, gap, refused, cost }
}

/** Every problem with a page, one sentence each. An empty list means the page keeps the contract. */
export function pageProblems(answer: unknown, options: PageOptions): string[] {
  const checks = pageChecks(answer, options)
  return [...checks.shape, ...checks.cursor, ...checks.gap, ...checks.refused, ...checks.cost]
}

/** `refused[]` or `failed[]`: each entry a final or retryable drop, with the id and the reason. */
function entries(value: unknown, where: string, problems: string[]): { external_id: string }[] {
  if (value === undefined) {
    problems.push(`${where} must be a list, empty when nothing was dropped`)
    return []
  }
  if (!Array.isArray(value)) {
    problems.push(`${where} must be a list`)
    return []
  }
  const found: { external_id: string }[] = []
  for (const [index, entry] of value.entries()) {
    if (!plain(entry) || typeof entry["external_id"] !== "string" || entry["external_id"].length === 0 || entry["external_id"].length > 512) {
      problems.push(`${where}[${index}] must be { external_id, reason }`)
      continue
    }
    if (!text(entry["reason"], 200) || entry["reason"] === "") problems.push(`${where}[${index}] names no reason`)
    found.push({ external_id: entry["external_id"] })
  }
  return found
}

/** `gap: { reason, since, until? }` when history was lost. */
function gapChecks(value: unknown, where: string, problems: string[]): void {
  if (value === undefined) return
  if (!plain(value)) {
    problems.push(`${where} gap must be an object`)
    return
  }
  const reason = value["reason"]
  if (reason !== "expired" && reason !== "window-truncated") problems.push(`${where} gap.reason must be expired or window-truncated`)
  if (!instant(value["since"])) problems.push(`${where} gap.since must be an ISO date-time with an offset`)
  if (value["until"] !== undefined && !instant(value["until"])) problems.push(`${where} gap.until must be an ISO date-time with an offset`)
  if (instant(value["since"]) && instant(value["until"]) && Date.parse(value["since"]) > Date.parse(value["until"])) {
    problems.push(`${where} gap.since is after gap.until`)
  }
}

/** `cost`, what the provider reported: required for a billed source. */
function costChecks(value: unknown, source: SourceItem, where: string, problems: string[]): void {
  if (value === undefined) {
    if (source.cost.class === "billed") problems.push(`${where} cost is missing: a billed source reports what the provider charged`)
    return
  }
  if (!plain(value)) problems.push(`${where} cost must be an object`)
}

/** One event of the page: each field of §2.1, and no duplicate id. */
function validateEvent(event: unknown, where: string, problems: string[], seen: Set<string>): void {
  if (!plain(event)) {
    problems.push(`${where} is not an object`)
    return
  }
  const id = event["external_id"]
  if (typeof id !== "string" || id.length === 0 || id.length > 512) problems.push(`${where} external_id must be 1 to 512 characters`)
  else {
    if (seen.has(id)) problems.push(`${where} external_id ${id} appears twice`)
    seen.add(id)
  }
  const kind = event["kind"]
  if (typeof kind !== "string" || !(CORE_KINDS.includes(kind) || X_KIND.test(kind))) {
    problems.push(`${where} kind must be one of ${CORE_KINDS.join(", ")}, or x-<plugin>/<kind>`)
  }
  if (!instant(event["occurred_at"])) problems.push(`${where} occurred_at must be an ISO date-time with an offset`)
  if (event["title"] !== undefined && !text(event["title"], 300)) problems.push(`${where} title must be at most 300 characters`)
  if (event["text"] !== undefined && !text(event["text"], 4096)) problems.push(`${where} text must be at most 4096 characters`)
  if (event["thread"] !== undefined && typeof event["thread"] !== "string") problems.push(`${where} thread must be a string when present`)
  if (event["url"] !== undefined && (typeof event["url"] !== "string" || !/^https:\/\//.test(event["url"]))) problems.push(`${where} url must be https`)
  if (event["labels"] !== undefined) {
    if (!Array.isArray(event["labels"]) || event["labels"].length > 20) problems.push(`${where} labels must be a list of at most 20`)
    else if (!event["labels"].every((label) => text(label, 64))) problems.push(`${where} each label must be at most 64 characters`)
  }
  if (event["actors"] !== undefined) {
    if (!Array.isArray(event["actors"]) || event["actors"].length > 20) problems.push(`${where} actors must be a list of at most 20`)
    else {
      for (const [index, actor] of event["actors"].entries()) {
        if (!plain(actor) || typeof actor["id"] !== "string" || actor["id"].length === 0) problems.push(`${where} actors[${index}] must be { id, label? }`)
        else if (actor["label"] !== undefined && typeof actor["label"] !== "string") problems.push(`${where} actors[${index}].label must be a string when present`)
      }
    }
  }
  if (typeof event["hash"] !== "string" || !/^sha256:[0-9a-f]{64}$/.test(event["hash"])) problems.push(`${where} hash must be sha256:<hex>`)
}
