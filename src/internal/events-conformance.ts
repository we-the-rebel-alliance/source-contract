/**
 * `eventsListConformance`: the events half of the conformance kit (design §3, `conformance`; the family owns this part,
 * Memory owns the kit around it).
 *
 * With contract 1's fixtures it runs contract 1's checks, unchanged, so each of the nine plugins' existing tests
 * passes as it is. Each addition of the final design is checked when the page carries it (`resultProblems` checks
 * `refused`, `failed`, `gap`, `cost`, `scope`, `plugin` and `asOf` whenever present) and, where a check needs to know
 * something about the source, when the fixture says so:
 *
 * - `maxBytes`: every page within the source's declared `maxBytes`;
 * - `kinds`: every event of a kind the source declares (`reads`);
 * - `refused`: the external_ids a full listing refuses, in order;
 * - `scope` and `scopeEcho`: the scope passed on every call, and echoed by every page;
 * - `binding`: the cursor is the library's bound cursor, and the same state bound to another plugin, account or scope
 *   is refused;
 * - `codes`: every refusal carries the table's code (`CURSOR_INVALID`, `INPUT_INVALID`, `SOURCE_UNKNOWN`);
 * - and always: no secret pattern survives in an event's title or text (the draft's conformance check 3).
 *
 * **The seam for Memory's kit.** `hooks.onCall` sees every call and its answer (Memory's recording permission context
 * records the assertions here), and `hooks.after` adds the problems of the checks Memory owns: `probe` reads no
 * content, `details` only with in-scope event fields, `failed[]` holds the cursor, and `gap` and `CURSOR_EXPIRED`
 * round-trip. This module does not implement those; it gives them every page the walk listed.
 */
import { decodeBoundCursor, encodeBoundCursor, encodeCursor, type CursorBinding, type Scope } from "../cursor.ts"
import {
  MAX_PAGE_BYTES,
  PAGE,
  parseSourceError,
  resultProblems,
  sinceTime,
  type EventsListInput,
  type EventsListResult,
  type EventsOwner,
} from "./events.ts"
import { secretKinds } from "./secrets.ts"

/** What one call answered, for `hooks.onCall`. */
export interface ConformanceCall {
  /** The check that made the call, such as "the first page" or "a malformed cursor". */
  readonly what: string
  readonly input: EventsListInput
  readonly result?: unknown
  readonly error?: unknown
}

/** Where Memory's kit plugs in (see the module's comment). */
export interface ConformanceHooks {
  readonly onCall?: (call: ConformanceCall) => void
  readonly after?: (walk: { readonly whole?: EventsListResult; readonly pages: readonly EventsListResult[] }) => readonly string[] | Promise<readonly string[]>
}

/** What a source's fixture holds, for `eventsListConformance`. */
export interface ConformanceFixtures {
  /** The `source` every result and event names. */
  readonly source: string
  /** The `account` every result and event names; also passed as the input's account when set. */
  readonly account?: string
  /** Pass `source` on every call, as a collector does for a plugin with several sources. */
  readonly sourceInput?: boolean
  /** The owner every result names. */
  readonly owner?: EventsOwner
  /** Passed as `since` on every call without a cursor. Every event must be at or after it. */
  readonly since?: string
  /** The external_ids a full listing from `since` yields, oldest first. At most `PAGE.max`. */
  readonly expected: readonly string[]
  /** The limit of the paged walk; 2 by default. */
  readonly pageSize?: number

  // The final design's additions. Each is checked only when given.

  /** The source's declared `maxBytes`: every page's JSON is at most this. `MAX_PAGE_BYTES` when absent. */
  readonly maxBytes?: number
  /** The kinds the source declares (`reads`): every event is one of them. */
  readonly kinds?: readonly string[]
  /** The external_ids a full listing from `since` refuses, in order. */
  readonly refused?: readonly string[]
  /** Passed as `scope` on every call. */
  readonly scope?: Scope
  /** Every page echoes the scope (canonical). */
  readonly scopeEcho?: boolean
  /** The source uses the library's bound cursor for this plugin (`../cursor`, version 2). */
  readonly binding?: { readonly plugin: string }
  /** Every refusal carries the table's code. */
  readonly codes?: boolean
  readonly hooks?: ConformanceHooks
}

export type EventsList = (input: EventsListInput) => Promise<unknown>

type Listed = { readonly result?: EventsListResult; readonly error?: unknown }

const describeError = (error: unknown) => (error instanceof Error ? error.message.split("\n", 1)[0] : String(error))

/**
 * Every way `list` breaks the contract over `fixtures`, one sentence each; none when it keeps it. It lists everything
 * at once and page by page, checks each result, that the pages join up to exactly the expected events with nothing
 * repeated or skipped, that an earlier cursor lists the same page again, that the last cursor lists nothing, that every
 * result names the source and account, an empty first page included, that the owner, account and hashes hold steady,
 * and that a bad limit, a source the plugin does not have or a cursor it did not issue is refused. `list` runs the
 * source's events_list as its tool or RPC method does, input check included, over data that does not change.
 */
export async function eventsListConformance(list: EventsList, fixtures: ConformanceFixtures): Promise<string[]> {
  const problems: string[] = []
  const hooks = fixtures.hooks ?? {}
  const maxBytes = fixtures.maxBytes ?? MAX_PAGE_BYTES
  const call = async (input: EventsListInput, what: string): Promise<Listed> => {
    try {
      const result = (await list(input)) as EventsListResult
      hooks.onCall?.({ what, input, result })
      return { result }
    } catch (error) {
      hooks.onCall?.({ what, input, error })
      return { error }
    }
  }
  const scope: EventsListInput = {
    ...(fixtures.account === undefined ? {} : { account: fixtures.account }),
    ...(fixtures.sourceInput ? { source: fixtures.source } : {}),
    ...(fixtures.scope === undefined ? {} : { scope: fixtures.scope }),
  }
  const base: EventsListInput = { ...(fixtures.since === undefined ? {} : { since: fixtures.since }), ...scope }
  const after = (cursor: string): EventsListInput => ({ cursor, ...scope })
  const pageSize = fixtures.pageSize ?? 2
  const since = fixtures.since === undefined ? undefined : sinceTime(fixtures.since)
  const owners = new Set<string>()
  const accounts = new Set<string>()
  const hashes = new Map<string, string>()

  const check = (listed: Listed, what: string, limit: number): EventsListResult | undefined => {
    if (listed.error !== undefined) {
      problems.push(`${what} failed: ${describeError(listed.error)}`)
      return undefined
    }
    const found = resultProblems(listed.result, limit, maxBytes)
    problems.push(...found.map((problem) => `${what}: ${problem}`))
    if (found.length > 0) return undefined
    const result = listed.result!
    if (result.source !== fixtures.source) problems.push(`${what}: the result names the source ${result.source}, not ${fixtures.source}`)
    if (fixtures.account !== undefined && result.account !== fixtures.account) problems.push(`${what}: the result names the account ${result.account}, not ${fixtures.account}`)
    accounts.add(result.account)
    owners.add(JSON.stringify(result.owner))
    if (fixtures.owner && JSON.stringify(result.owner) !== JSON.stringify({ id: fixtures.owner.id, label: fixtures.owner.label })) problems.push(`${what}: the owner is not the fixture's owner`)
    if (fixtures.scopeEcho && fixtures.scope !== undefined) {
      if (result.scope === undefined) problems.push(`${what}: the result does not echo the scope`)
      else if (JSON.stringify(result.scope) !== JSON.stringify(sortedScope(fixtures.scope))) problems.push(`${what}: the result's scope is not the call's scope`)
    }
    for (const event of result.events) {
      if (event.source !== fixtures.source) problems.push(`${what}: an event names the source ${event.source}, not ${fixtures.source}`)
      if (fixtures.account !== undefined && event.account !== fixtures.account) problems.push(`${what}: an event names the account ${event.account}, not ${fixtures.account}`)
      if (since !== undefined && Date.parse(event.occurred_at) < since) problems.push(`${what}: the event ${event.external_id} is from before since`)
      if (fixtures.kinds !== undefined && !fixtures.kinds.includes(event.kind)) problems.push(`${what}: the event ${event.external_id} is a ${event.kind}, which the source does not declare`)
      const secrets = secretKinds([event.title, event.text].filter(Boolean).join("\n"))
      if (secrets.length > 0) problems.push(`${what}: the event ${event.external_id} holds a secret (${secrets.join(", ")}); it belongs in refused[]`)
      const known = hashes.get(event.external_id)
      if (known !== undefined && known !== event.hash) problems.push(`${what}: the event ${event.external_id} has another hash than before`)
      hashes.set(event.external_id, event.hash)
    }
    return result
  }
  const ids = (result: EventsListResult | undefined) => result?.events.map((event) => event.external_id) ?? []

  // Everything at once.
  const whole = check(await call({ ...base, limit: PAGE.max }, "one call with the largest limit"), "one call with the largest limit", PAGE.max)
  if (whole) {
    if (JSON.stringify(ids(whole)) !== JSON.stringify(fixtures.expected)) problems.push(`one call with the largest limit lists [${ids(whole).join(", ")}], not [${fixtures.expected.join(", ")}]`)
    if (fixtures.expected.length <= PAGE.max && whole.more) problems.push("one call with the largest limit lists everything but says more")
    if (fixtures.refused !== undefined) {
      const refusedIds = (whole.refused ?? []).map((entry) => entry.external_id)
      if (JSON.stringify(refusedIds) !== JSON.stringify(fixtures.refused)) problems.push(`one call with the largest limit refuses [${refusedIds.join(", ")}], not [${fixtures.refused.join(", ")}]`)
    }
  }

  // Page by page.
  const pages: EventsListResult[] = []
  let page = check(await call({ ...base, limit: pageSize }, "the first page"), "the first page", pageSize)
  const most = fixtures.expected.length + (fixtures.refused?.length ?? 0) + 10
  while (page) {
    pages.push(page)
    if (!page.more) break
    if (pages.length > most) {
      problems.push(`the paged walk did not end after ${most} pages`)
      break
    }
    const what = `page ${pages.length + 1}`
    page = check(await call({ ...after(page.cursor), limit: pageSize }, what), what, pageSize)
  }
  const walked = pages.flatMap(ids)
  if (JSON.stringify(walked) !== JSON.stringify(fixtures.expected)) problems.push(`the pages of ${pageSize} list [${walked.join(", ")}], not [${fixtures.expected.join(", ")}]`)

  // An earlier cursor lists the same page again.
  if (pages.length >= 2) {
    const again = check(await call({ ...after(pages[0]!.cursor), limit: pageSize }, "the first cursor again"), "the first cursor again", pageSize)
    if (again && JSON.stringify(again.events) !== JSON.stringify(pages[1]!.events)) problems.push("the first cursor, used again, does not list the second page again")
  }

  // The last cursor lists nothing.
  const last = pages.at(-1)
  if (last && !last.more) {
    const end = check(await call({ ...after(last.cursor), limit: pageSize }, "the last cursor"), "the last cursor", pageSize)
    if (end && (end.events.length > 0 || end.more)) problems.push("the last cursor lists events again, or says more")
  }

  // An empty first page still names its source and account, so a consumer can bind a source that has nothing yet.
  const empty = check(await call({ ...scope, since: "2999-01-01T00:00:00Z", limit: pageSize }, "an empty first page"), "an empty first page", pageSize)
  if (empty && (empty.events.length > 0 || empty.more)) problems.push("a first page from a since in the future lists events, or says more")

  if (owners.size > 1) problems.push("the owner changes between calls")
  if (accounts.size > 1) problems.push("the account changes between calls")

  // Refusals. With `codes`, each must carry one of the table's codes.
  const refused = async (input: EventsListInput, what: string, codes: readonly string[]) => {
    const listed = await call(input, what)
    if (listed.error === undefined) {
      problems.push(`${what} was not refused`)
      return
    }
    if (fixtures.codes) {
      const parsed = parseSourceError(listed.error)
      if (!parsed?.canonical || !codes.includes(parsed.canonical)) problems.push(`${what} was refused without the code ${codes.join(" or ")}${parsed ? ` (it says ${parsed.code})` : ""}`)
    }
  }
  const INPUT = ["INPUT_INVALID"] as const
  const CURSOR = ["CURSOR_INVALID"] as const
  await refused({ ...base, limit: PAGE.max + 1 }, `a limit of ${PAGE.max + 1}`, INPUT)
  await refused({ ...base, limit: 0 }, "a limit of 0", INPUT)
  await refused({ ...after("not-a-cursor"), limit: pageSize }, "a malformed cursor", CURSOR)
  await refused({ ...after(encodeCursor(`${fixtures.source}-other`, {})), limit: pageSize }, "another source's cursor", CURSOR)
  await refused({ ...base, source: `${fixtures.source}-other`, limit: pageSize }, "a source the plugin does not have", ["SOURCE_UNKNOWN", "INPUT_INVALID"])

  // The bound cursor: the source's cursor is the library's, bound to (plugin, source, account, scope), and the same
  // state bound to anything else is refused rather than restarted.
  const first = pages[0]
  if (fixtures.binding !== undefined && first) {
    const binding: CursorBinding = { plugin: fixtures.binding.plugin, source: fixtures.source, account: first.account, ...(fixtures.scope === undefined ? {} : { scope: fixtures.scope }) }
    const decoded = decodeBoundCursor(binding, first.cursor)
    if (!decoded.ok) problems.push("the first page's cursor is not the library's cursor bound to this plugin, source, account and scope")
    else {
      const others: [string, CursorBinding][] = [
        ["another plugin's", { ...binding, plugin: `${binding.plugin}-other` }],
        ["another account's", { ...binding, account: `${binding.account}-other` }],
        ["another scope's", { ...binding, scope: { ...(binding.scope ?? {}), conformance: ["other"] } }],
      ]
      for (const [whose, other] of others) await refused({ ...after(encodeBoundCursor(other, decoded.state)), limit: pageSize }, `${whose} bound cursor`, CURSOR)
    }
  }

  if (hooks.after) problems.push(...(await hooks.after({ ...(whole ? { whole } : {}), pages })))
  return problems
}

/** A scope as `canonicalScope` writes it, without throwing on a malformed fixture. */
function sortedScope(scope: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(scope).sort()) {
    const value = scope[key]
    out[key] = Array.isArray(value) ? [...new Set(value)].sort() : value
  }
  return out
}

/** `eventsListConformance`, for a test: throws one error that lists every problem. */
export async function assertEventsListConformance(list: EventsList, fixtures: ConformanceFixtures): Promise<void> {
  const problems = await eventsListConformance(list, fixtures)
  if (problems.length > 0) throw new Error(`events_list breaks the contract:\n- ${problems.join("\n- ")}`)
}
