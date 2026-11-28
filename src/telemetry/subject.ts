/**
 * The envelope's pseudonymous subject and its W3C trace context.
 *
 * A subject is a compact string of the ids that belong to one person, agent, session and trace: `person=…;agent=…`.
 * The ids are pseudonyms, never an account, a token or a raw provider id. The trace id is also carried by the
 * distributed-tracing extension `traceparent`, and the two must name the same trace when both are present.
 */

/** The pseudonymous ids an event may name. A part is left out when the work has no such id. */
export interface TelemetrySubject {
  readonly person?: string
  readonly agent?: string
  readonly session?: string
  readonly trace?: string
}

/** The parts of a subject, in the order an envelope writes them. */
export const SUBJECT_KEYS = ["person", "agent", "session", "trace"] as const

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/
const ZERO = /^0+$/
const TRACE_ID = /^[0-9a-f]{32}$/

/** A non-empty string with no control character, as an envelope attribute takes. */
function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${where} is not a non-empty string`)
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`${where} carries a control character`)
  return value
}

/** True when `value` is a W3C `traceparent`: a valid version, trace id, span id and flags, without all-zero ids. */
export function isTraceparent(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = TRACEPARENT.exec(value)
  if (match === null) return false
  const [, version, traceId, spanId] = match
  return version !== "ff" && !ZERO.test(traceId!) && !ZERO.test(spanId!)
}

/** The trace id a `traceparent` names, or undefined when it is not one. */
export function traceIdOf(traceparent: string): string | undefined {
  return isTraceparent(traceparent) ? TRACEPARENT.exec(traceparent)?.[2] : undefined
}

/** The envelope's `subject` string, or undefined when no id is present. */
export function subjectString(subject: TelemetrySubject | undefined): string | undefined {
  if (subject === undefined) return undefined
  for (const key of Object.keys(subject)) {
    if (!(SUBJECT_KEYS as readonly string[]).includes(key)) {
      throw new TypeError(`subject.${key} is not person, agent, session or trace`)
    }
  }
  const parts: string[] = []
  for (const key of SUBJECT_KEYS) {
    const value = subject[key]
    if (value === undefined) continue
    parts.push(`${key}=${encodeURIComponent(text(value, `subject.${key}`))}`)
  }
  return parts.length === 0 ? undefined : parts.join(";")
}

/** A parsed subject, or the problems that stop `subject` from being one. */
export type ParsedSubject =
  | { readonly ok: true; readonly value: TelemetrySubject }
  | { readonly ok: false; readonly problems: readonly string[] }

/** Parse the envelope's `subject` string. Duplicate or unknown keys are refused. */
export function parseSubject(subject: string | undefined): ParsedSubject {
  if (subject === undefined) return { ok: true, value: {} }
  const value: Record<string, string> = {}
  const problems: string[] = []
  for (const part of subject.split(";")) {
    const at = part.indexOf("=")
    if (at <= 0) {
      problems.push(`subject: "${part}" is not key=value`)
      continue
    }
    const key = part.slice(0, at)
    const raw = part.slice(at + 1)
    if (!(SUBJECT_KEYS as readonly string[]).includes(key)) {
      problems.push(`subject.${key}: is not person, agent, session or trace`)
      continue
    }
    if (Object.hasOwn(value, key)) {
      problems.push(`subject.${key}: is named more than once`)
      continue
    }
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      problems.push(`subject.${key}: is not percent-encoded text`)
      continue
    }
    if (decoded === "" || /[\u0000-\u001f\u007f]/.test(decoded)) {
      problems.push(`subject.${key}: is not a non-empty id`)
      continue
    }
    value[key] = decoded
  }
  if (problems.length > 0) return { ok: false, problems }
  const trace = value["trace"]
  if (trace !== undefined && (!TRACE_ID.test(trace) || ZERO.test(trace))) {
    return { ok: false, problems: ["subject.trace: is not a W3C trace id"] }
  }
  return { ok: true, value: value as TelemetrySubject }
}
