/**
 * `details`: a read of one event's detail, called only with the event fields it names, pinned to the confirmed scope.
 *
 * The kit builds the call from the declaration: `fields` holds exactly the event fields in `detail.from`, `scope` is
 * the confirmed scope, and nothing else travels. An event's title and text are never an input, so item text cannot
 * choose what the library reads next.
 */
import type { Detail, Scope, SourceItem } from "../schema/types.ts"

/** What the kit passes to a detail read: the confirmed scope, and the event fields the detail declares. */
export interface DetailCallInput {
  readonly account: string
  readonly scope: Readonly<Record<string, readonly string[]>>
  readonly fields: Readonly<Record<string, unknown>>
}

/** The text the kit puts in an event's prose, to prove it never reaches a detail read. */
export const SENTINEL = "CONFORMANCE-SENTINEL-ITEM-TEXT"

/**
 * A valid event of the source, for a detail to read: every field of §2.1, with the sentinel in the two prose fields.
 * The fields a detail names are identifiers, so no detail ever sees the sentinel.
 */
export function syntheticEvent(source: SourceItem): Record<string, unknown> {
  const host = source.urlHosts?.[0]?.replace(/^\*\./, "") ?? "example.com"
  const kind = source.kind === "events" ? source.reads : "file"
  return {
    external_id: "conformance-1",
    kind,
    occurred_at: "2026-01-01T09:00:00.000Z",
    title: SENTINEL,
    text: SENTINEL,
    url: `https://${host}/conformance/1`,
    thread: "conformance-thread:1",
    actors: [{ id: "conformance:1", label: "Conformance" }],
    labels: ["conformance"],
    hash: "conformance-placeholder",
  }
}

/**
 * The call the kit makes for a detail: the named event fields, the scope, and the account.
 *
 * `event` overrides the synthetic event's values for the fields the detail names, so a fixture can record a real one.
 * A key the detail does not name is ignored: only `from` travels.
 */
export function detailInput(
  detail: Detail,
  source: SourceItem,
  options: {
    readonly account: string
    readonly scope?: Readonly<Record<string, readonly string[]>> | undefined
    readonly event?: Readonly<Record<string, unknown>> | undefined
  },
): DetailCallInput {
  const event = { ...syntheticEvent(source), ...(options.event ?? {}) }
  const fields: Record<string, unknown> = {}
  for (const field of detail.from) fields[field] = event[field]
  return { account: options.account, scope: options.scope ?? {}, fields }
}

/** Every problem with a detail call's input: only the declared event fields, and never item text. */
export function detailInputProblems(detail: Detail, input: DetailCallInput): string[] {
  const problems: string[] = []
  const where = `details(${detail.id})`
  for (const field of Object.keys(input.fields)) {
    if (!detail.from.includes(field as Detail["from"][number])) problems.push(`${where} was called with "${field}", which its from does not name`)
  }
  if (JSON.stringify(input.fields).includes(SENTINEL)) problems.push(`${where} was called with an event's title or text: a detail's input comes only from identifiers`)
  if (input.account.length === 0) problems.push(`${where} was called with no account`)
  return problems
}

/** The scope a detail fixture names, checked against the source's declared keys. */
export function scopeProblems(scope: Readonly<Record<string, readonly string[]>>, declared: Scope | undefined, where: string): string[] {
  const problems: string[] = []
  const keys = declared?.keys ?? []
  if (keys.length > 0 && Object.keys(scope).length === 0) {
    problems.push(`${where} was called with no confirmed scope, which is not what a person confirms`)
  }
  for (const key of Object.keys(scope)) {
    if (!keys.includes(key)) problems.push(`${where} names the scope key "${key}", which the source does not declare`)
  }
  for (const [key, values] of Object.entries(scope)) {
    if (!Array.isArray(values) || values.length === 0) problems.push(`${where}.${key} must list at least one confirmed value`)
  }
  return problems
}
