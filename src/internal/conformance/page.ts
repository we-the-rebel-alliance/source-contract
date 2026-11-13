/**
 * The page result of `events_list`, contract version 1 (§2.1): the fields Memory's checks read, and nothing else.
 *
 * The page and the event are the `events` module's shape. This file does not define them: it reads the only fields the
 * checks below need — `events[].external_id`, `refused[]`, `failed[]`, `cursor`, `more`, `gap` and `cost` — through a
 * narrow interface, and it checks `source` and `plugin` so a page can be attributed to the source it belongs to. When the
 * `events` module lands its validator, this adopts it and the narrow reads go. The envelope's `account`, `owner`, `asOf`
 * and `trust`, and every other event field, are not checked here.
 *
 * The checks: `failed[]` holds the cursor back, `refused[]` is final, `gap` is shaped and runs forwards, and a billed
 * source reports its cost.
 */
import type { SourceItem } from "../schema/types.ts"

/** What a page is checked against. */
export interface PageOptions {
  readonly source: SourceItem
  /** The plugin's package name, which every result names. */
  readonly plugin: string
  /** The input the call was made with, so `failed[]` can be held against the cursor it must not advance. */
  readonly input: Readonly<Record<string, unknown>>
  /** True for a detail read, which answers one event: it has no cursor to hold back and no page to resume. */
  readonly detail?: boolean | undefined
}

/** The page's problems, by concern. */
export interface PageChecks {
  /** The attribution, the cursor and the two lists of drops. */
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

/** An ISO date-time with an offset, as §2.1 writes `gap.since`. */
export const instant = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)

/** The page's problems, by concern. */
export function pageChecks(answer: unknown, options: PageOptions): PageChecks {
  const shape: string[] = []
  const cursor: string[] = []
  const gap: string[] = []
  const refused: string[] = []
  const cost: string[] = []
  const where = "the page"
  if (!plain(answer)) return { shape: ["the page is not an object"], cursor: [], gap: [], refused: [], cost: [] }

  if (answer["source"] !== options.source.id) shape.push(`${where} names source ${JSON.stringify(answer["source"])}, not ${options.source.id}`)
  if (answer["plugin"] !== options.plugin) shape.push(`${where} names plugin ${JSON.stringify(answer["plugin"])}, not ${options.plugin}`)
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
    if (!plain(event) || typeof event["external_id"] !== "string" || event["external_id"].length === 0) {
      shape.push(`${where} events[${index}] has no external_id`)
      continue
    }
    seen.add(event["external_id"])
  }
  for (const id of new Set(refusedEntries)) {
    if (seen.has(id)) refused.push(`${where} lists ${id} as an event and in refused[]: a refusal is final`)
  }

  if (options.detail !== true && failed.length > 0) {
    const held = typeof options.input["cursor"] === "string" ? options.input["cursor"] : ""
    if (answer["cursor"] !== held) {
      cursor.push(`${where} failed[] holds the cursor back, and this page answered ${JSON.stringify(answer["cursor"])} instead of ${JSON.stringify(held)}`)
    }
  }
  if (options.detail !== true && Array.isArray(events) && events.length === 0 && answer["more"] === false && answer["cursor"] === "") {
    cursor.push(`${where} is empty and carries no cursor: a later call must be able to resume`)
  }
  return { shape, cursor, gap, refused, cost }
}

/** Every problem with a page, one sentence each. An empty list means the checks that apply found nothing. */
export function pageProblems(answer: unknown, options: PageOptions): string[] {
  const checks = pageChecks(answer, options)
  return [...checks.shape, ...checks.cursor, ...checks.gap, ...checks.refused, ...checks.cost]
}

/** `refused[]` or `failed[]`: each entry a final or retryable drop, with the id and the reason. */
function entries(value: unknown, where: string, problems: string[]): string[] {
  if (value === undefined) {
    problems.push(`${where} must be a list, empty when nothing was dropped`)
    return []
  }
  if (!Array.isArray(value)) {
    problems.push(`${where} must be a list`)
    return []
  }
  const found: string[] = []
  for (const [index, entry] of value.entries()) {
    if (!plain(entry) || typeof entry["external_id"] !== "string" || entry["external_id"].length === 0) {
      problems.push(`${where}[${index}] must name the external_id it dropped`)
      continue
    }
    if (typeof entry["reason"] !== "string" || entry["reason"] === "") problems.push(`${where}[${index}] names no reason`)
    found.push(entry["external_id"])
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
