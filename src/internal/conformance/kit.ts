/**
 * The conformance kit: one report per source, from a declaration and the plugin's own answers.
 *
 * The kit runs the plugin's reads itself, through a recording permission whose rules are the grants the declaration
 * derives. So a read that asserts more than the declaration holds is refused where the host would refuse it, and a
 * grant no read asserts is reported at the end: declared equals asserted. There are two such sessions, and they never
 * mix: the **running** session holds the source's own action and `permission.operations`, and the **bind** session holds
 * only `scope.suggest`'s tool and operations, because a bind-time read never enters a running grant.
 *
 * The kit takes page results, cursors and permission contexts as inputs. It defines no page, cursor or permission of its
 * own: those are the `events`, `cursor` and `permission` modules' work.
 *
 * The calls it makes, which a plugin's test adapts to its own tools:
 *
 *   list({ ...input }, context)                 → the page result of events_list
 *   probe({ source, account? }, context)        → { account, owner, scopes? }
 *   details[id]({ account, scope, fields })     → the page result of one detail read
 *   suggest({ source, account }, context)       → { options: [{ id, label? }] }, in the bind session
 *   snapshot({ params? }, context)              → the snapshot result, recorded for its grants only
 *
 * `context.permission.assert` is that session's permission: a read asserts the actions and operations it uses.
 */
import type { Detail, SourceItem } from "../schema/types.ts"
import { declarationProblems, type ToolDeclaration } from "./rules.ts"
import {
  assertionMatches,
  bindGrantsFor,
  grantsFor,
  identityGrantsFor,
  recordingPermission,
  unusedGrants,
  type Assertion,
  type Grant,
  type SessionContext,
} from "./permission.ts"
import { pageChecks, type PageOptions } from "./page.ts"
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

/** One detail read: the event it names, the scope it is pinned to, and what it must answer. */
export interface DetailCase {
  /** The detail's id, as the source declares it. */
  readonly id: string
  /** The confirmed scope the read is pinned to: a person's channels, calendars, labels. */
  readonly scope?: Readonly<Record<string, readonly string[]>> | undefined
  /** The event's values for the fields the detail names. Default: the kit's synthetic event. */
  readonly event?: Readonly<Record<string, unknown>> | undefined
  /** What the call must answer. Absent: an in-scope call, which must answer a page. A refusal: an event outside the scope. */
  readonly expect?: Refusal | undefined
}

/** The plugin's reads, as the kit calls them. */
export interface ConformanceCalls {
  readonly list?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined
  readonly probe: (input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>
  readonly details?: Readonly<Record<string, (input: DetailCallInput, context: SessionContext) => Promise<unknown>>> | undefined
  readonly suggest?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined
  /** A snapshot read: recorded for the grants it asserts. Its result's shape is not this kit's to check. */
  readonly snapshot?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined
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
  /** The detail reads to run: at least one in scope, and one outside it when the source confirms scope keys. */
  readonly detailCases?: readonly DetailCase[] | undefined
  /** The `snapshot_read` calls, whose grants are recorded. */
  readonly snapshotCases?: readonly Readonly<Record<string, unknown>>[] | undefined
  /** The operations the probe may assert, beyond the source's own action. §2.2 does not name them, so the kit asks. */
  readonly identityOperations?: readonly string[] | undefined
  /** The account the kit hands a read; a display value, never a grant. */
  readonly account?: string | undefined
  /** The grants to run under. Default: the kit's provisional derivation from the declaration. */
  readonly grants?: readonly Grant[] | undefined
  /**
   * Set when a page is fetched atomically: one provider call answers the whole page, so no single item can fail on its
   * own and `failed[]` can never be produced (Calendar's `events.list` is one). The `failed-holds-cursor` check is then
   * not applicable, and the reason is shown in the report. The reason must be non-empty; an empty one is ignored.
   */
  readonly atomicPages?: { readonly reason: string } | undefined
}

/** One named check: whether it ran, whether it applies at all, and what it found. */
export interface ConformanceCheck {
  readonly name: string
  readonly ran: boolean
  /** True when the check does not apply to this source, such as a page check on a snapshot. */
  readonly notApplicable: boolean
  /** Why the check does not apply, when the source states it: an atomic page's reason, for instance. */
  readonly reason?: string | undefined
  readonly problems: readonly string[]
}

/** A source's report. `ok` is true only when every check ran or does not apply, and none found a problem. */
export interface ConformanceReport {
  readonly source: string
  readonly plugin: string
  /** The identity operations the kit was told a probe may assert, so a reader sees them. */
  readonly identityOperations: readonly string[]
  readonly checks: readonly ConformanceCheck[]
  readonly problems: readonly string[]
  readonly ok: boolean
  /** True when a check applies and did not run: the report says nothing about it, so it is not ok. */
  readonly incomplete: boolean
}

/** The code §2.3's table gives a read that reaches past what the person confirmed. */
const OUT_OF_SCOPE_CODE = "PERMISSION_DENIED"

/** Where a source restarts when it reports an expired cursor without a hint of its own. */
const RECOVERY_SINCE = "2026-01-01T00:00:00.000Z"

const CHECKS = [
  "declaration",
  "page-result",
  "failed-holds-cursor",
  "gap-and-cursor-expired",
  "refused-is-final",
  "billed-cost",
  "identity-grants",
  "probe",
  "details",
  "suggest",
  "unused-grants",
] as const

/**
 * Run every conformance check for one source.
 *
 * `ok` requires every check to have run, or not to apply: a check that applies and did not run leaves the report
 * `incomplete` and not ok, so a source can never pass by having nothing to check.
 */
export async function sourceConformance(options: SourceConformanceOptions): Promise<ConformanceReport> {
  const { plugin, source, tools, calls } = options
  const cases = options.cases ?? []
  const account = options.account ?? "conformance"
  // Declared must equal asserted overall: an identity operation is one of the source's operations, so the running
  // session already holds it, and no content read may assert it.
  const identityOperations = options.identityOperations ?? []
  const runningGrants = options.grants ?? grantsFor(source)
  const running = recordingPermission(runningGrants)
  const identityGrants = identityGrantsFor(source, identityOperations)
  const identity: string[] = []
  const bind = recordingPermission(bindGrantsFor(source))
  const context: SessionContext = { account, permission: running.permission }
  const bindContext: SessionContext = { account, permission: bind.permission }
  const checks: ConformanceCheck[] = []
  const add = (name: string, problems: readonly string[], ran = true, notApplicable = false, reason?: string): void => {
    checks.push({ name, ran, notApplicable, ...(reason === undefined ? {} : { reason }), problems })
  }
  const isEvents = source.kind === "events"

  add("declaration", declarationProblems({ contractVersion: 1, items: [source] }, { tools }))

  const shape: string[] = []
  const cursor: string[] = []
  const gap: string[] = []
  const refused: string[] = []
  const cost: string[] = []
  let sawFailed = false
  let sawRefused = false
  let sawGap = false

  if (cases.length > 0 && calls.list === undefined) shape.push("events_list cases are declared and the kit has no list call")

  for (const item of cases) {
    const where = `events_list(${item.name})`
    const expect = item.expect ?? "page"
    const assertedBeforePage = running.assertions.length
    let answer: unknown
    try {
      answer = await calls.list?.(item.input, context)
    } catch (error) {
      if (isRefusal(expect)) {
        if (!messageOf(error).includes(expect.refuses)) shape.push(`${where}: refused with "${messageOf(error)}", not the expected ${expect.refuses}`)
        continue
      }
      if (expect === "expired") {
        sawGap = true
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
      sawGap = true
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
    identity.push(...identityOverlap(running.assertions.slice(assertedBeforePage), identityGrants, where))
    sawFailed ||= hasEntries(answer, "failed")
    sawRefused ||= hasEntries(answer, "refused")
    if (expect === "empty" && plain(answer) && Array.isArray(answer["events"]) && (answer["events"] as unknown[]).length > 0) {
      shape.push(`${where}: it must list nothing`)
    }
  }
  add("page-result", shape, isEvents && cases.length > 0, !isEvents)
  // A page fetched in one call can never have a per-item failure, so the source may say so; an empty reason is no
  // reason at all, and the check applies as it does by default.
  const atomicReason = options.atomicPages?.reason.trim() ?? ""
  const atomic = isEvents && atomicReason !== ""
  add("failed-holds-cursor", cursor, atomic ? false : isEvents && sawFailed, !isEvents || atomic, atomic ? atomicReason : undefined)
  add("gap-and-cursor-expired", gap, isEvents && sawGap, !isEvents)
  add("refused-is-final", refused, isEvents && sawRefused, !isEvents)
  add("billed-cost", cost, source.cost.class === "billed" && isEvents, source.cost.class !== "billed")

  for (const operation of identityOperations) {
    if (!source.permission.operations.includes(operation)) {
      identity.push(`${operation} is declared an identity operation and is not among permission.operations: a source's operations are everything its reads assert, identity included`)
    }
  }
  const probe: string[] = []
  const assertedBeforeProbe = running.assertions.length
  try {
    const answer = await calls.probe({ source: source.id, account }, context)
    probe.push(...probeProblems(answer, source))
  } catch (error) {
    probe.push(`probe(${source.id}) failed: ${messageOf(error)}`)
  }
  const probeAssertions = running.assertions.slice(assertedBeforeProbe)
  if (probeAssertions.length === 0) probe.push(`probe(${source.id}) asserted nothing: it reads the identity under its own grant`)
  probe.push(...identityProblems(probeAssertions, source, options.identityOperations ?? []))
  add("probe", probe)

  const details: string[] = []
  const declaredDetails = isEvents ? (source.details ?? []) : []
  const detailCases: readonly DetailCase[] = options.detailCases ?? declaredDetails.flatMap((detail) => (isEvents ? [{ id: detail.id }] : []))
  const scopeKeys = source.scope?.keys ?? []
  for (const detail of declaredDetails) {
    const read = calls.details?.[detail.id]
    if (read === undefined) {
      details.push(`details(${detail.id}) is declared and the kit has no call for it`)
      continue
    }
    const own = detailCases.filter((entry) => entry.id === detail.id)
    const inside = own.filter((entry) => entry.expect === undefined)
    const outside = own.filter((entry) => entry.expect !== undefined)
    for (const entry of own) await assertDetail(entry, detail, source, read, context, running, runningGrants, identityOperations, plugin, details)
    if (inside.length === 0) details.push(`details(${detail.id}) has no case inside the confirmed scope`)
    if (scopeKeys.length > 0 && outside.length === 0) {
      details.push(`details(${detail.id}) has no case outside the confirmed scope: a read pinned to a scope must refuse one that is not`)
    }
  }
  for (const entry of detailCases) {
    if (!declaredDetails.some((detail) => detail.id === entry.id)) details.push(`details(${entry.id}) is not declared by the source`)
  }
  add("details", details, declaredDetails.length > 0, declaredDetails.length === 0)

  const suggest: string[] = []
  const suggested = source.scope?.suggest
  if (suggested !== undefined) {
    const assertedBeforeSuggest = bind.assertions.length
    if (calls.suggest === undefined) suggest.push(`scope.suggest names "${suggested.tool}" and the kit has no call for it`)
    else {
      try {
        const answer = await calls.suggest({ source: source.id, account }, bindContext)
        suggest.push(...suggestProblems(answer, `scope.suggest(${suggested.tool})`))
      } catch (error) {
        suggest.push(`scope.suggest(${suggested.tool}) failed: ${messageOf(error)}`)
      }
      const suggestAssertions = bind.assertions.slice(assertedBeforeSuggest)
      if (suggestAssertions.length === 0) suggest.push(`scope.suggest(${suggested.tool}) asserted nothing: even at bind it reads under the grant`)
      suggest.push(...outsideGrants(suggestAssertions, bindGrantsFor(source), `scope.suggest(${suggested.tool})`))
      for (const grant of unusedGrants(bindGrantsFor(source), bind.assertions)) {
        suggest.push(`the bind declaration grants ${grant.action} on ${grant.resource}, which no bind-time read asserts: a suggest operation is exactly what it asserts`)
      }
    }
  }
  add("suggest", suggest, suggested !== undefined, suggested === undefined)

  const snapshot: string[] = []
  if (!isEvents) {
    const snapshotCases = options.snapshotCases ?? []
    if (calls.snapshot === undefined) snapshot.push("the source is a snapshot and the kit has no snapshot call, so its grants cannot be checked")
    else {
      for (const input of snapshotCases) {
        const assertedBeforeSnapshot = running.assertions.length
        try {
          await calls.snapshot(input, context)
          identity.push(...identityOverlap(running.assertions.slice(assertedBeforeSnapshot), identityGrants, `snapshot_read(${JSON.stringify(input)})`))
        } catch (error) {
          snapshot.push(`snapshot_read(${JSON.stringify(input)}) failed: ${messageOf(error)}`)
        }
      }
      if (snapshotCases.length === 0) snapshot.push("the source is a snapshot and no snapshot case ran")
    }
  }

  add("identity-grants", identity)

  const unused = unusedGrants(runningGrants, running.assertions).map(
    (grant) => `the declaration grants ${grant.action} on ${grant.resource}, which no read asserts: a source's grants are exactly what it asserts`,
  )
  const unusedRan = isEvents ? cases.length > 0 : snapshot.length === 0
  add("unused-grants", [...unused, ...snapshot], unusedRan, false)

  if (running.undeclared.length > 0 || bind.undeclared.length > 0) {
    checks.push({
      name: "undeclared-grants",
      ran: true,
      notApplicable: false,
      problems: [...running.undeclared, ...bind.undeclared].map((action) => `${action} was asserted and is not among the grants the declaration derives`),
    })
  }

  const problems = checks.flatMap((check) => check.problems)
  const incomplete = checks.some((check) => !check.ran && !check.notApplicable)
  return { source: source.id, plugin, identityOperations, checks, problems, ok: problems.length === 0 && !incomplete, incomplete }
}

/** `sourceConformance`, for a test or a check: throws one error naming every problem. */
export function assertConformance(report: ConformanceReport): void {
  if (report.ok) return
  const failed = report.checks.filter((check) => check.problems.length > 0).length
  const missing = report.checks.filter((check) => !check.ran && !check.notApplicable).map((check) => check.name)
  const why = [
    ...(failed > 0 ? [`${failed} checks failed`] : []),
    ...(missing.length > 0 ? [`${missing.join(", ")} did not run`] : []),
  ].join(", and ")
  throw new Error(`CONFORMANCE_FAILED: the source ${report.source} of ${report.plugin} is not conformant: ${why}. Next step: fix each problem listed.\n- ${report.problems.join("\n- ")}`)
}

/**
 * One detail read. Inside the confirmed scope it must answer a page and assert only the source's grants; outside the
 * scope, which is the event the fixture names, it must be refused: a read pinned to what a person confirmed never reads
 * past it.
 */
async function assertDetail(
  entry: DetailCase,
  detail: Detail,
  source: SourceItem,
  read: (input: DetailCallInput, context: SessionContext) => Promise<unknown>,
  context: SessionContext,
  running: ReturnType<typeof recordingPermission>,
  runningGrants: readonly Grant[],
  identityOperations: readonly string[],
  plugin: string,
  problems: string[],
): Promise<void> {
  const where = `details(${detail.id})`
  const scope = entry.scope ?? {}
  problems.push(...scopeProblems(scope, source.scope, where))
  const input = detailInput(detail, source, {
    account: context.account,
    scope,
    ...(entry.event === undefined ? {} : { event: entry.event }),
  })
  if (entry.expect !== undefined) {
    // §2.3's table has one code for a read the person's grant does not cover: PERMISSION_DENIED.
    if (entry.expect.refuses !== OUT_OF_SCOPE_CODE) {
      problems.push(`${where} expects ${entry.expect.refuses} for an out-of-scope read, and §2.3's table names ${OUT_OF_SCOPE_CODE}`)
    }
    try {
      await read(input, context)
      problems.push(`${where} answered a call outside the confirmed scope: it must be refused with ${OUT_OF_SCOPE_CODE}: … Next step: …`)
    } catch (error) {
      const message = messageOf(error)
      if (!message.startsWith(`${OUT_OF_SCOPE_CODE}: `) || !message.includes("Next step: ")) {
        problems.push(`${where} refused an out-of-scope call with "${message}", not ${OUT_OF_SCOPE_CODE}: … Next step: …`)
      }
    }
    return
  }
  problems.push(...detailInputProblems(detail, input))
  const assertedBefore = running.assertions.length
  try {
    const answer = await read(input, context)
    const result = pageChecks(answer, { source, plugin, input: {}, detail: true })
    problems.push(...result.shape, ...result.cursor, ...result.gap, ...result.refused, ...result.cost)
  } catch (error) {
    problems.push(`${where} failed inside the confirmed scope: ${messageOf(error)}`)
  }
  problems.push(...outsideGrants(running.assertions.slice(assertedBefore), runningGrants, where))
  problems.push(...identityOverlap(running.assertions.slice(assertedBefore), identityGrantsFor(source, identityOperations), where))
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

/** An expired cursor answered with an error: it must be CURSOR_EXPIRED, and its backfill hint must read on. */
async function expiredByError(
  where: string,
  error: unknown,
  options: { readonly source: SourceItem; readonly plugin: string; readonly calls: ConformanceCalls; readonly context: SessionContext },
): Promise<string[]> {
  const message = messageOf(error)
  if (!/^CURSOR_EXPIRED: /.test(message)) return [`${where}: failed with "${message}", not CURSOR_EXPIRED or a gap`]
  const since = String((error as { since?: unknown }).since ?? "")
  const hint = /(?:Z|[+-]\d{2}:\d{2})$/.test(since) && !Number.isNaN(Date.parse(since)) ? since : RECOVERY_SINCE
  let next: unknown
  try {
    next = await options.calls.list?.({ since: hint }, options.context)
  } catch (failed) {
    return [`${where} after the restart: failed with ${messageOf(failed)}`]
  }
  const checks = pageChecks(next, { source: options.source, plugin: options.plugin, input: { since: hint } })
  return [...checks.shape, ...checks.cursor].map((problem) => `${where} after the restart: ${problem}`)
}

/** Every assertion a read made that its own session does not grant. */
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

/** A content read may not assert an identity operation: those belong to the probe. */
function identityOverlap(assertions: readonly Assertion[], identityGrants: readonly Grant[], where: string): string[] {
  const problems: string[] = []
  for (const assertion of assertions) {
    const resources = assertion.resources.length > 0 ? assertion.resources : ["*"]
    for (const resource of resources) {
      if (identityGrants.some((grant) => assertionMatches([{ action: assertion.action, resources: [resource] }], grant))) {
        problems.push(`${where}: a content read asserts ${assertion.action} on ${resource}, which is an identity operation: identity reads belong to probe`)
      }
    }
  }
  return problems
}

/** A probe may assert the source's own action and its identity operations, and nothing else. */
function identityProblems(assertions: readonly Assertion[], source: SourceItem, identityOperations: readonly string[]): string[] {
  const action = source.kind === "events" ? source.permission.events : source.permission.tool
  const head = source.id.split(".")[0] ?? source.id
  const allowed: Grant[] = [{ action, resource: "*" }]
  for (const operation of identityOperations) {
    allowed.push(
      operation.includes(".")
        ? { action: `${head}.read`, resource: `{account}:${operation}` }
        : { action: `${head}_${operation}`, resource: "*" },
    )
  }
  const problems: string[] = []
  for (const assertion of assertions) {
    const resources = assertion.resources.length > 0 ? assertion.resources : ["*"]
    for (const resource of resources) {
      if (!allowed.some((grant) => assertionMatches([{ action: assertion.action, resources: [resource] }], grant))) {
        problems.push(`probe(${source.id}) asserts ${assertion.action} on ${resource}, which is not an identity operation: a probe reads the account, never content`)
      }
    }
  }
  return problems
}
