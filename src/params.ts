/**
 * Params: what a read's inputs may say that only the reader can resolve, resolved by the library at read time
 * (design §2.3). A plugin receives plain values and never resolves them itself.
 *
 * - **Relative times**, in the person's time zone: `"now"`, or a signed whole number of minutes, hours, days or weeks,
 *   `"-90m"`, `"+2h"`, `"-7d"`, `"+1w"`. Minutes and hours are exact; days and weeks move the date in the person's time
 *   zone and keep the time of day, so `"-1d"` across a clock change is still "this time yesterday". The result is an
 *   ISO date-time in UTC, rounded down to the minute, so every read within one minute sends the same input (and a cache
 *   keyed on it holds). At most 366 days either way.
 * - **Windows**, in the person's time zone: `"today"`, `"yesterday"` and `"tomorrow"`, each `{ since, until }` from
 *   midnight to midnight; or `{ since, until }` with each a relative or absolute time.
 * - **`$me`**: the signed-in account, as the source's `probe` names its owner (`owner.id`).
 *
 * Which params a snapshot source takes, and which may be relative or `$me`, its descriptor says
 * (`"params": { "window": { "relative": true } }`); an events source's `since` may always be relative.
 *
 * Seeded from Artifacts' relative-time resolver (ADR 0046, `resolveRelativeTimes` in we-the-rebel-alliance/artifacts):
 * the same rounding to the minute and the same 366-day bound, written as plain strings instead of `{"$now": …}`.
 */
import type { Checked } from "./internal/checked.ts"

/** How far a relative time reaches, either way (Artifacts' default). */
export const MAX_RELATIVE_DAYS = 366

/** The windows a param may name. */
export const WINDOWS = ["today", "yesterday", "tomorrow"] as const
export type WindowName = (typeof WINDOWS)[number]

/** The whole-value marker for the signed-in account. */
export const ME = "$me"

/** What a descriptor says about one param. Keys this module does not know are left for the plugin. */
export interface ParamSpec {
  /** The param takes a relative time or a window, which the library resolves. */
  readonly relative?: boolean
  /** The param may be `$me`. */
  readonly me?: boolean
  readonly [key: string]: unknown
}

/** What a read resolves against: when it runs, the person's time zone, and the signed-in account when known. */
export interface ParamsContext {
  /** Now, as a Date or epoch milliseconds. */
  readonly now: Date | number
  /** The person's IANA time zone, such as Europe/Amsterdam. */
  readonly timeZone: string
  /** The signed-in account's owner id, from `probe`; `$me` needs it. */
  readonly me?: string
}

/** A window, resolved: ISO date-times in UTC, `since` inclusive and `until` exclusive. */
export interface ResolvedWindow {
  readonly since: string
  readonly until: string
}

const RELATIVE = /^(?:now|([+-])(\d{1,6})([mhdw]))$/
const ABSOLUTE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/
const MINUTE = 60_000
const DAY_MINUTES = 24 * 60

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const epoch = (now: Date | number) => (now instanceof Date ? now.getTime() : now)

/** True when the time zone is one this runtime knows. */
export function isTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0) return false
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone })
    return true
  } catch {
    return false
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = formatters.get(timeZone)
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    formatters.set(timeZone, found)
  }
  return found
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number }

/** The wall clock in `timeZone` at `instant`. */
function wall(instant: number, timeZone: string): Wall {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) }
}

/** The offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offset(instant: number, timeZone: string): number {
  const at = wall(instant, timeZone)
  return Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute) - Math.floor(instant / MINUTE) * MINUTE
}

/**
 * The instant a wall-clock time in `timeZone` names. A time a clock change skips is moved forward by the change; a
 * time it repeats is the earlier of the two.
 */
function instantOf(at: Wall, timeZone: string): number {
  const guess = Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute)
  // The offsets either side of any change near this time: a change never comes twice within a day.
  const before = guess - offset(guess - 12 * 60 * MINUTE, timeZone)
  const after = guess - offset(guess + 12 * 60 * MINUTE, timeZone)
  const same = (instant: number) => {
    const found = wall(instant, timeZone)
    return found.year === at.year && found.month === at.month && found.day === at.day && found.hour === at.hour && found.minute === at.minute
  }
  const valid = [before, after].filter(same)
  // Repeated: the earlier. Skipped: read with the offset before the change, which moves it forward by the change.
  return valid.length > 0 ? Math.min(...valid) : before
}

const iso = (instant: number) => new Date(instant).toISOString()

/** A relative time resolved to an ISO date-time in UTC, or undefined when `value` is not one in bounds. */
export function resolveRelativeTime(value: string, context: Pick<ParamsContext, "now" | "timeZone">): string | undefined {
  const match = RELATIVE.exec(value)
  if (!match) return undefined
  const now = Math.floor(epoch(context.now) / MINUTE) * MINUTE
  if (value === "now") return iso(now)
  const amount = Number(match[2]) * (match[1] === "-" ? -1 : 1)
  const unit = match[3] as "m" | "h" | "d" | "w"
  const minutes = Math.abs(amount) * { m: 1, h: 60, d: DAY_MINUTES, w: 7 * DAY_MINUTES }[unit]
  if (minutes > MAX_RELATIVE_DAYS * DAY_MINUTES) return undefined
  if (unit === "m" || unit === "h") return iso(now + amount * (unit === "m" ? 1 : 60) * MINUTE)
  const at = wall(now, context.timeZone)
  const days = amount * (unit === "w" ? 7 : 1)
  const shifted = new Date(Date.UTC(at.year, at.month - 1, at.day + days))
  return iso(instantOf({ ...at, year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }, context.timeZone))
}

/** A named window resolved, midnight to midnight in the person's time zone. */
export function resolveWindow(name: WindowName, context: Pick<ParamsContext, "now" | "timeZone">): ResolvedWindow {
  const at = wall(epoch(context.now), context.timeZone)
  const start = { yesterday: -1, today: 0, tomorrow: 1 }[name]
  const midnight = (days: number) => {
    const date = new Date(Date.UTC(at.year, at.month - 1, at.day + days))
    return iso(instantOf({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 0, minute: 0 }, context.timeZone))
  }
  return { since: midnight(start), until: midnight(start + 1) }
}

/** A time param: a relative time resolved, or an absolute ISO date or date-time with Z or an offset, unchanged. */
function time(value: unknown, where: string, context: ParamsContext): Checked<string> {
  if (typeof value === "string") {
    if (ABSOLUTE.test(value) && Number.isFinite(Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value))) return { ok: true, value }
    const resolved = resolveRelativeTime(value, context)
    if (resolved !== undefined) return { ok: true, value: resolved }
  }
  return {
    ok: false,
    problems: [`${where} must be "now", a relative time such as "-7d" or "+2h" (at most ${MAX_RELATIVE_DAYS} days), or an ISO date-time with Z or an offset`],
  }
}

/** A relative param: a window name, `{ since, until }`, or one time. */
function relative(value: unknown, where: string, context: ParamsContext): Checked<unknown> {
  if (typeof value === "string" && (WINDOWS as readonly string[]).includes(value)) return { ok: true, value: resolveWindow(value as WindowName, context) }
  if (plain(value)) {
    const keys = Object.keys(value)
    const extra = keys.filter((key) => key !== "since" && key !== "until")
    if (extra.length > 0 || keys.length === 0) return { ok: false, problems: [`${where} must be a window: "today", "yesterday", "tomorrow", or { since, until }`] }
    const resolved: Record<string, string> = {}
    const problems: string[] = []
    for (const key of keys) {
      const checked = time(value[key], `${where}.${key}`, context)
      if (checked.ok) resolved[key] = checked.value
      else problems.push(...checked.problems)
    }
    if (problems.length === 0 && resolved.since !== undefined && resolved.until !== undefined && Date.parse(resolved.since) > Date.parse(resolved.until)) {
      problems.push(`${where}.since is after ${where}.until`)
    }
    return problems.length === 0 ? { ok: true, value: resolved } : { ok: false, problems }
  }
  return time(value, where, context)
}

/** The context's own problems: a time zone the runtime does not know, or a now that is not a time. */
function contextProblems(context: ParamsContext): string[] {
  const problems: string[] = []
  if (!isTimeZone(context.timeZone)) problems.push(`the time zone "${String(context.timeZone)}" is not an IANA time zone this runtime knows`)
  if (!Number.isFinite(epoch(context.now))) problems.push("now is not a time")
  return problems
}

/**
 * A snapshot read's params, resolved against what the source declares. A param the source does not declare is refused;
 * `$me` only where the param allows it and the signed-in account is known; a relative param is resolved; anything else
 * goes to the plugin as it is, for the plugin's own input check.
 */
export function resolveParams(declared: Readonly<Record<string, ParamSpec>> | undefined, given: unknown, context: ParamsContext): Checked<Record<string, unknown>> {
  if (given === undefined) return { ok: true, value: {} }
  if (!plain(given)) return { ok: false, problems: ["params must be an object"] }
  const problems = contextProblems(context)
  if (problems.length > 0) return { ok: false, problems }
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(given)) {
    const spec = declared && Object.hasOwn(declared, key) ? declared[key] : undefined
    const where = `params.${key}`
    if (spec === undefined) {
      problems.push(`${where} is not a param this source declares`)
      continue
    }
    if (value === ME) {
      if (spec.me !== true) problems.push(`${where} may not be ${ME}: the source does not declare it`)
      else if (typeof context.me !== "string" || context.me.length === 0) problems.push(`${where} is ${ME}, and the signed-in account is not known: probe the source first`)
      else resolved[key] = context.me
      continue
    }
    if (spec.relative === true) {
      const checked = relative(value, where, context)
      if (checked.ok) resolved[key] = checked.value
      else problems.push(...checked.problems)
      continue
    }
    resolved[key] = value
  }
  return problems.length === 0 ? { ok: true, value: resolved } : { ok: false, problems }
}

/** An events read's `since`, resolved: a relative time, or an absolute one unchanged. */
export function resolveSince(since: unknown, context: ParamsContext): Checked<string> {
  const problems = contextProblems(context)
  if (problems.length > 0) return { ok: false, problems }
  return time(since, "since", context)
}
