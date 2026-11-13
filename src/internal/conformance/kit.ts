/**
 * The conformance kit: one report per source, from a declaration and the plugin's own answers.
 *
 * The kit runs the plugin's reads itself, through a recording permission whose rules are the grants the declaration
 * derives. So a read that asserts more than the declaration holds is refused where the host would refuse it, and a
 * grant no read asserts is reported at the end: declared equals asserted.
 *
 * The kit takes page results, cursors and permission contexts as inputs. It defines no page, cursor or permission of
 * its own: those are the `events`, `cursor` and `permission` modules' work.
 *
 * The calls it makes, which a plugin's test adapts to its own tools:
 *
 *   list({ ...input }, context)                 → the page result of events_list
 *   probe({ source, account? }, context)        → { account, owner, scopes? }
 *   details[id]({ account, scope, fields })     → the page result of one detail read
 *   suggest({ source, account }, context)       → { options: [{ id, label? }] }
 *
 * `context.permission.assert` is the session's permission: a read asserts the actions and operations it uses.
 */
import type { SourceItem } from "../schema/types.ts"
import { declarationProblems, type ToolDeclaration } from "./rules.ts"
import {
  assertionMatches,
  grantsFor,
  recordingPermission,
  unusedGrants,
  type Assertion,
  type Grant,
  type SessionContext,
} from "./permission.ts"
import { instant, pageChecks, type PageOptions } from "./page.ts"
import { probeProblems } from "./probe.ts"
import { detailInput, detailInputProblems, scopeProblems, type DetailCallInput } from "./details.ts"
import { suggestProblems } from "./suggest.ts"

/** A case the source refuses, with the code or words its error carries. */
export interface Refusal {
  readonly refuses: string
}

/** What a case expects: a page, an empty page, an expired cursor, or a refusal. */
export type CaseExpectation = "page" | "empty" | "expired" | Refusal

/** One `events_list` call and what it must answer. */
export interface PageCase {
  /** The case's name, as a person reads it. */
  readonly name: string
  /** The call's input. */
  readonly input: Readonly<Record<string, unknown>>
  /** What the answer must be. `page` when absent. */
  readonly expect?: CaseExpectation | undefined
}

/** One detail read and the scope it is pinned to. */
export interface DetailCase {
  /** The detail's id, as the source declares it. */
  readonly id: string
  /** The confirmed scope the read is pinned to: a person's channels, calendars, labels. */
  readonly scope?: Readonly<Record<string, readonly string[]>> | undefined
  /** The event's values for the fields the detail names. Default: the kit's synthetic event. */
  readonly event?: Readonly<Record<string, unknown>> | undefined
}

/** The plugin's reads, as the kit calls them. */
export interface ConformanceCalls {
  readonly list?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined
  readonly probe: (input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>
  readonly details?: Readonly<Record<string, (input: DetailCallInput, context: SessionContext) => Promise<unknown>>> | undefined
  readonly suggest?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined
}

/** What `sourceConformance` checks. */
export interface SourceConformanceOptions {
  /** The plugin's package name, which every result names. */
  readonly plugin: string
  /** The source item, as the schema parsed it. */
  readonly source: SourceItem
  /** The plugin's declared tools, so every tool the source names can be checked. */
  readonly tools: readonly ToolDeclaration[]
  /** The plugin's reads. */
  readonly calls: ConformanceCalls
  /** The `events_list` calls and their expected answers. */
  readonly cases?: readonly PageCase[] | undefined
  /** The detail reads to run. Default: every detail the source declares. */
  readonly detailCases?: readonly DetailCase[] | undefined
  /** The account the kit hands a read; a display value, never a grant. */
  readonly account?: string | undefined
  /** The grants to run under. Default: `grantsFor(source)`. */
  readonly grants?: readonly Grant[] | undefined
}

/** One named check: whether it ran, and what it found. */
export interface ConformanceCheck {
  readonly name: string
  readonly ran: boolean
  readonly problems: readonly string[]
}

/** A source's report. `ok` is true when every check that ran passed. */
export interface ConformanceReport {
  readonly source: string
  readonly plugin: string
  readonly checks: readonly ConformanceCheck[]
  readonly problems: readonly string[]
  readonly ok: boolean
}

/** Where a source restarts when it reports an expired cursor without a hint of its own. */
const RECOVERY_SINCE = "2026-01-01T00:00:00.000Z"

/**
 * Run every conformance check for one source.
 *
 * The checks, in order: `declaration`, `page-result`, `failed-holds-cursor`, `gap-and-cursor-expired`,
 * `refused-is-final`, `billed-cost`, `probe`, `details`, `suggest`, `unused-grants`.
 */
export async function sourceConformance(options: SourceConformanceOptions): Promise<ConformanceReport> {
  const { plugin, source, tools, calls } = options
  const cases = options.cases ?? []
  const account = options.account ?? "conformance"
  const grants = options.grants ?? grantsFor(source)
  const recording = recordingPermission(grants)
  const context: SessionContext = { account, permission: recording.permission }
  const checks: ConformanceCheck[] = []
  const add = (name: string, problems: readonly string[], ran = true): void => {
    checks.push({ name, ran, problems })
  }

  add("declaration", declarationProblems({ contractVersion: 1, items: [source] }, { tools }))

  const shape: string[] = []
  const cursor: string[] = []
  const gap: string[] = []
  const refused: string[] = []
  const cost: string[] = []
  let sawFailed = false
  let sawRefused = false
  let sawGap = false
  let sawExpiry = false

  if (cases.length > 0 && calls.list === undefined) shape.push("events_list cases are declared and the kit has no list call")

  for (const item of cases) {
    const where = `events_list(${item.name})`
    const expect = item.expect ?? "page"
    let answer: unknown
    try {
      answer = await calls.list?.(item.input, context)
    } catch (error) {
      if (isRefusal(expect)) {
        if (!messageOf(error).includes(expect.refuses)) shape.push(`${where}: refused with "${messageOf(error)}", not the expected ${expect.refuses}`)
        continue
      }
      if (expect === "expired") {
        sawExpiry = true
        gap.push(...(await expiredByError(where, error, { source, plugin, calls, context })))
        continue
      }
      shape.push(`${where}: failed: ${messageOf(error)}`)
      continue
    }
    if (isRefusal(expect)) {
      shape.push(`${where}: it must be refused with ${expect.refuses}, and it answered`)
      continue
    }
    if (expect === "expired") {
      sawExpiry = true
      gap.push(...(await expiredByGap(where, answer, { source, plugin, calls, context })))
      continue
    }
    const page: PageOptions = { source, plugin, input: item.input }
    const result = pageChecks(answer, page)
    shape.push(...result.shape)
    cursor.push(...result.cursor)
    gap.push(...result.gap)
    refused.push(...result.refused)
    cost.push(...result.cost)
    sawFailed ||= hasEntries(answer, "failed")
    sawRefused ||= hasEntries(answer, "refused")
    sawGap ||= plain(answer) && answer["gap"] !== undefined
    if (expect === "empty" && Array.isArray((answer as Record<string, unknown>)["events"]) && ((answer as Record<string, unknown>)["events"] as unknown[]).length > 0) {
      shape.push(`${where}: it must list nothing`)
    }
  }
  add("page-result", shape, cases.length > 0)
  add("failed-holds-cursor", cursor, sawFailed)
  add("gap-and-cursor-expired", gap, sawGap || sawExpiry)
  add("refused-is-final", refused, sawRefused)
  add("billed-cost", cost, source.cost.class === "billed" && cases.length > 0)

  const probe: string[] = []
  const assertedBeforeProbe = recording.assertions.length
  try {
    const answer = await calls.probe({ source: source.id, account }, context)
    probe.push(...probeProblems(answer, source))
  } catch (error) {
    probe.push(`probe(${source.id}) failed: ${messageOf(error)}`)
  }
  const probeAssertions = recording.assertions.slice(assertedBeforeProbe)
  if (probeAssertions.length === 0) probe.push(`probe(${source.id}) asserted nothing: it reads the identity under its own grant`)
  probe.push(...outsideGrants(probeAssertions, grants, `probe(${source.id})`))
  add("probe", probe)

  const details: string[] = []
  const declaredDetails = source.kind === "events" ? (source.details ?? []) : []
  const detailCases: readonly DetailCase[] = options.detailCases ?? declaredDetails.map((detail) => ({ id: detail.id }))
  for (const detailCase of detailCases) {
    const detail = declaredDetails.find((entry) => entry.id === detailCase.id)
    if (detail === undefined) {
      details.push(`details(${detailCase.id}) is not declared by the source`)
      continue
    }
    const read = calls.details?.[detail.id]
    if (read === undefined) {
      details.push(`details(${detail.id}) is declared and the kit has no call for it`)
      continue
    }
    const scope = detailCase.scope ?? {}
    details.push(...scopeProblems(scope, source.scope, `details(${detail.id})`))
    const input = detailInput(detail, source, { account, scope, ...(detailCase.event === undefined ? {} : { event: detailCase.event }) })
    details.push(...detailInputProblems(detail, input))
    const assertedBeforeDetail = recording.assertions.length
    try {
      const answer = await read(input, context)
      const result = pageChecks(answer, { source, plugin, input: {} })
      details.push(...result.shape, ...result.cursor, ...result.gap, ...result.refused, ...result.cost)
    } catch (error) {
      details.push(`details(${detail.id}) failed: ${messageOf(error)}`)
    }
    details.push(...outsideGrants(recording.assertions.slice(assertedBeforeDetail), grants, `details(${detail.id})`))
  }
  for (const detail of declaredDetails.filter((entry) => !detailCases.some((detailCase) => detailCase.id === entry.id))) {
    details.push(`details(${detail.id}) is declared and no detail case ran it`)
  }
  add("details", details, declaredDetails.length > 0)

  const suggest: string[] = []
  const suggestTool = source.scope?.suggest
  if (suggestTool !== undefined) {
    const assertedBeforeSuggest = recording.assertions.length
    if (calls.suggest === undefined) suggest.push(`scope.suggest names "${suggestTool}" and the kit has no call for it`)
    else {
      try {
        const answer = await calls.suggest({ source: source.id, account }, context)
        suggest.push(...suggestProblems(answer, `scope.suggest(${suggestTool})`))
      } catch (error) {
        suggest.push(`scope.suggest(${suggestTool}) failed: ${messageOf(error)}`)
      }
      const suggestAssertions = recording.assertions.slice(assertedBeforeSuggest)
      if (suggestAssertions.length === 0) suggest.push(`scope.suggest(${suggestTool}) asserted nothing: even at bind it reads under the grant`)
      suggest.push(...outsideGrants(suggestAssertions, grants, `scope.suggest(${suggestTool})`))
    }
  }
  add("suggest", suggest, suggestTool !== undefined)

  const unused =
    source.kind === "events" && cases.length > 0
      ? unusedGrants(grants, recording.assertions).map(
          (grant) => `the declaration grants ${grant.action} on ${grant.resource}, which no read asserts: a source's grants are exactly what it asserts`,
        )
      : []
  add("unused-grants", unused, source.kind === "events" && cases.length > 0)

  if (recording.undeclared.length > 0) {
    checks.push({
      name: "undeclared-grants",
      ran: true,
      problems: recording.undeclared.map((action) => `${action} was asserted and is not among the grants the declaration derives`),
    })
  }

  const problems = checks.flatMap((check) => check.problems)
  return { source: source.id, plugin, checks, problems, ok: problems.length === 0 }
}

/** `sourceConformance`, for a test or a check: throws one error naming every problem. */
export function assertConformance(report: ConformanceReport): void {
  if (report.ok) return
  throw new Error(
    `CONFORMANCE_FAILED: the source ${report.source} of ${report.plugin} fails ${report.checks.filter((check) => check.problems.length > 0).length} checks. Next step: fix each problem listed.\n- ${report.problems.join("\n- ")}`,
  )
}

/** The word or code an error carries, for a refusal case. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

const isRefusal = (expect: CaseExpectation): expect is Refusal => typeof expect === "object" && expect !== null && "refuses" in expect
const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const hasEntries = (answer: unknown, key: string): boolean => plain(answer) && Array.isArray(answer[key]) && (answer[key] as unknown[]).length > 0

/** An expired cursor answered with `gap`: the fresh cursor must read on, without another expiry. */
async function expiredByGap(
  where: string,
  answer: unknown,
  options: { readonly source: SourceItem; readonly plugin: string; readonly calls: ConformanceCalls; readonly context: SessionContext },
): Promise<string[]> {
  if (!plain(answer) || !plain(answer["gap"]) || answer["gap"]["reason"] !== "expired") {
    return [`${where}: an expired cursor must answer gap.reason "expired", or throw CURSOR_EXPIRED`]
  }
  const cursor = answer["cursor"]
  if (typeof cursor !== "string" || cursor.length === 0) return [`${where}: an expired cursor must answer a cursor a consumer can restart from`]
  let next: unknown
  try {
    next = await options.calls.list?.({ cursor }, options.context)
  } catch (error) {
    return [`${where} after the restart: failed with ${messageOf(error)}`]
  }
  const checks = pageChecks(next, { source: options.source, plugin: options.plugin, input: { cursor } })
  const problems = [...checks.shape, ...checks.cursor]
  if (plain(next) && plain(next["gap"]) && next["gap"]["reason"] === "expired") {
    problems.push(`${where}: the cursor the expired page answered expired again, so the round trip does not restart`)
  }
  return problems.map((problem) => `${where} after the restart: ${problem}`)
}

/** An expired cursor answered with an error: the backfill hint must read on. */
async function expiredByError(
  where: string,
  error: unknown,
  options: { readonly source: SourceItem; readonly plugin: string; readonly calls: ConformanceCalls; readonly context: SessionContext },
): Promise<string[]> {
  const message = messageOf(error)
  if (!/^CURSOR_EXPIRED: /.test(message)) return [`${where}: failed with "${message}", not CURSOR_EXPIRED or a gap`]
  const since = instant((error as { since?: unknown }).since) ? ((error as { since: string }).since) : RECOVERY_SINCE
  let next: unknown
  try {
    next = await options.calls.list?.({ since }, options.context)
  } catch (error) {
    return [`${where} after the restart: failed with ${messageOf(error)}`]
  }
  const checks = pageChecks(next, { source: options.source, plugin: options.plugin, input: { since } })
  return [...checks.shape, ...checks.cursor].map((problem) => `${where} after the restart: ${problem}`)
}

/** Every assertion a read made that its own source does not grant. */
function outsideGrants(assertions: readonly Assertion[], grants: readonly Grant[], where: string): string[] {
  const problems: string[] = []
  for (const assertion of assertions) {
    const resources = assertion.resources.length > 0 ? assertion.resources : ["*"]
    for (const resource of resources) {
      const held = grants.some((grant) => assertionMatches([{ action: assertion.action, resources: [resource] }], grant))
      if (!held) problems.push(`${where} asserts ${assertion.action} on ${resource}, which the source does not grant: a read asserts only its own grant`)
    }
  }
  return problems
}
