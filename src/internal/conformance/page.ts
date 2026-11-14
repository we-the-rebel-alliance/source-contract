/**
 * The page result of `events_list`: the `events` module's shape, plus Memory's three checks.
 *
 * The shape is the authority's: `resultProblems` (the same call `read` makes) validates the envelope, every event, the
 * lists of drops, `gap` and `cost`, and types the page as `EventsListResult`. On top of it this file keeps only what
 * Memory adds:
 *
 * - `failed[]` holds the cursor back: a page with a retryable drop answers the cursor it was called with;
 * - `refused[]` is final, and the family's `secretKinds` runs over every page, so an event holding a secret is refused
 *   rather than delivered;
 * - a billed source reports its `cost`.
 */
import { MAX_PAGE_BYTES, PAGE, REFUSAL_REASONS, isEventKindIn, resultProblems, secretKinds, sourceNamespace, type EventsListResult } from "../events.ts"
import type { SourceItem } from "../schema/types.ts"

/** What a page is checked against. */
export interface PageOptions {
  readonly source: SourceItem
  /** The plugin's package name, which every result names. */
  readonly plugin: string
  /** The input the call was made with, so `failed[]` can be held against the cursor it must not advance. */
  readonly input: Readonly<Record<string, unknown>>
  /** True for a detail read, which answers one event: it has no cursor to hold back. */
  readonly detail?: boolean | undefined
}

/** The page's problems, by concern. */
export interface PageChecks {
  /** The authority's problems: the envelope, every event, the drops, `gap` and `cost`'s shape. */
  readonly shape: readonly string[]
  /** `failed[]` holds the cursor back. */
  readonly cursor: readonly string[]
  /** `gap`'s shape is the authority's; this stays for the round-trip the kit also checks. */
  readonly gap: readonly string[]
  /** A refused id is never also an event, and an event holding a secret is refused. */
  readonly refused: readonly string[]
  /** `cost` is reported by a billed source. */
  readonly cost: readonly string[]
}

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The page's problems, by concern. */
export function pageChecks(answer: unknown, options: PageOptions): PageChecks {
  const shape = [...resultProblems(answer, PAGE.max, MAX_PAGE_BYTES)]
  // A source read through a page is not the app's: its plugin is the one that answered, so the page must name it.
  const page = answer as EventsListResult
  if (plain(answer) && answer["plugin"] !== options.plugin) {
    shape.push(`the page names plugin ${JSON.stringify(answer["plugin"])}, not ${options.plugin}`)
  }
  if (plain(answer) && answer["source"] !== namedSource(options.source)) {
    shape.push(`the page names source ${JSON.stringify(answer["source"])}, not ${namedSource(options.source)}`)
  }

  const cursor: string[] = []
  if (options.detail !== true && Array.isArray(page?.failed) && page.failed.length > 0) {
    const held = typeof options.input["cursor"] === "string" ? options.input["cursor"] : ""
    if (page.cursor !== held) {
      cursor.push(`the page failed[] holds the cursor back, and this page answered ${JSON.stringify(page.cursor)} instead of ${JSON.stringify(held)}`)
    }
  }

  const refused: string[] = []
  for (const [index, event] of (Array.isArray(page?.events) ? page.events : []).entries()) {
    // An extension kind belongs to its source's namespace (#15, through `events`' one rule).
    if (event.kind.startsWith("x-") && !isEventKindIn(event.kind, sourceNamespace(options.source.id))) {
      shape.push(`the page events[${index}] has the kind ${event.kind}, which is in another namespace than the source "${sourceNamespace(options.source.id)}"`)
    }
    const kinds = secretKinds([event.title, event.text].filter(Boolean).join("\n"))
    if (kinds.length > 0) {
      refused.push(`the page events[${index}] holds a secret (${kinds.join(", ")}): it belongs in refused[] with reason "secret"`)
    }
  }
  if (plain(answer) && Array.isArray(answer["refused"])) {
    for (const [index, entry] of answer["refused"].entries()) {
      if (plain(entry) && !(REFUSAL_REASONS as readonly unknown[]).includes(entry["reason"])) {
        refused.push(`the page refused[${index}] names no reason of ${REFUSAL_REASONS.join(", ")}`)
      }
    }
  }

  const cost: string[] = []
  if (plain(answer) && answer["cost"] === undefined && options.source.cost.class === "billed") {
    cost.push("the page cost is missing: a billed source reports what the provider charged")
  }
  return { shape, cursor, gap: [], refused, cost }
}

/** Every problem with a page, one sentence each. */
export function pageProblems(answer: unknown, options: PageOptions): string[] {
  const checks = pageChecks(answer, options)
  return [...checks.shape, ...checks.cursor, ...checks.gap, ...checks.refused, ...checks.cost]
}

/**
 * The name a page gives its source: the plugin's own (`input.source`, such as gmail), not the dotted contract id
 * (`gws.gmail`), because `events`' `SOURCE_PATTERN` accepts only a lowercase name.
 */
function namedSource(source: SourceItem): string {
  const named = source.input?.["source"]
  return typeof named === "string" ? named : source.id
}
