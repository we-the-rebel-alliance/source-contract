/**
 * Build one event in the CloudEvents 1.0 envelope, from the contract's catalogue (principles rule 1.4, decision 0005,
 * decision 0017).
 *
 *   const event = createEvent({
 *     type: "plugin.read",
 *     version: 1,
 *     source: { component: "slack", version: "1.2.3", deployment: "work" },
 *     subject: { person: "person_p_…", agent: "agent_p_…", session: "session_p_…" },
 *     fields: { method: "events_list", method_class: "read", … },
 *     traceparent: "00-…-…-01",
 *   })
 *
 * The caller supplies the values; the catalogue supplies each field's class. `id`, `time`, `source` and `subject` are
 * envelope facts, not fields, so a field can never shadow them. A malformed type, a field the catalogue does not declare
 * and any value the secret screen refuses throw here, before an event reaches a log.
 */
import { randomUUID } from "node:crypto"
import {
  catalogueEvent,
  eventType,
  TELEMETRY_CATALOGUE,
  type TelemetryCatalogue,
  type TelemetryEvent,
  type TelemetryFieldValue,
} from "./definition.ts"
import { isTraceparent, subjectString, traceIdOf, type TelemetrySubject } from "./subject.ts"
import { validateEvent } from "./validate.ts"

/** The component, its version and the deployment, as the envelope's `source` names them. */
export interface TelemetrySource {
  readonly component: string
  readonly version: string
  readonly deployment: string
}

/** What `createEvent` takes. The catalogue's own fields are the last input. */
export interface CreateEventInput {
  readonly type: string
  /** The event's version in the catalogue. A type with one version may leave it out. */
  readonly version?: number
  readonly source: TelemetrySource
  readonly subject?: TelemetrySubject
  readonly fields: Readonly<Record<string, unknown>>
  readonly traceparent?: string
  readonly id?: string
  readonly time?: string | number | Date
  /** The catalogue to use; the contract's by default. */
  readonly catalogue?: TelemetryCatalogue
}

/** A non-empty string with no control character. */
function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`telemetry: ${where} is not a non-empty string`)
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`telemetry: ${where} carries a control character`)
  return value
}

/** `plugin://<encoded component>/<encoded version>/<encoded deployment>`. */
function sourceString(source: TelemetrySource): string {
  if (typeof source !== "object" || source === null) throw new TypeError("telemetry: source names the component, version and deployment")
  const component = encodeURIComponent(text(source.component, "source.component"))
  const version = encodeURIComponent(text(source.version, "source.version"))
  const deployment = encodeURIComponent(text(source.deployment, "source.deployment"))
  return `plugin://${component}/${version}/${deployment}`
}

/** The ISO time an event carries. */
function eventTime(value: string | number | Date | undefined): string {
  if (value === undefined) return new Date().toISOString()
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError("telemetry: time is not a date")
  return date.toISOString()
}

/** Build one event, with each field's class taken from the catalogue, and refuse it when it is not valid. */
export function createEvent(input: CreateEventInput): TelemetryEvent {
  const catalogue = input.catalogue ?? TELEMETRY_CATALOGUE
  const version = input.version ?? 1
  const declared = catalogueEvent(catalogue, input.type, version)
  if (declared === undefined) throw new TypeError(`telemetry: ${eventType(input.type, version)} is not in the catalogue`)
  if (typeof input.fields !== "object" || input.fields === null || Array.isArray(input.fields)) {
    throw new TypeError(`telemetry: ${eventType(input.type, version)} fields is not an object`)
  }

  const fields = input.fields
  for (const [name, field] of Object.entries(declared.fields)) {
    if (!Object.hasOwn(fields, name) && field.optional !== true) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)} declares ${name} and the event leaves it out`)
    }
    if (Object.hasOwn(fields, name) && fields[name] === undefined && field.optional !== true) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)}.${name} has no value`)
    }
  }
  for (const name of Object.keys(fields)) {
    if (!Object.hasOwn(declared.fields, name)) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)} does not declare ${name}`)
    }
  }

  const data: Record<string, TelemetryFieldValue> = {}
  for (const [name, field] of Object.entries(declared.fields)) {
    if (!Object.hasOwn(fields, name)) continue
    const value = fields[name]
    if (value === undefined && field.optional === true) continue
    data[name] = { class: field.class, value }
  }

  let subject = input.subject
  if (input.traceparent !== undefined) {
    if (!isTraceparent(input.traceparent)) throw new TypeError("telemetry: traceparent is not a W3C traceparent")
    const trace = traceIdOf(input.traceparent)
    if (subject?.trace === undefined && trace !== undefined) subject = { ...subject, trace }
  }
  const subjectText = subjectString(subject)

  const event: TelemetryEvent = {
    specversion: "1.0",
    id: input.id === undefined ? randomUUID() : text(input.id, "id"),
    time: eventTime(input.time),
    type: eventType(declared.type, declared.version),
    source: sourceString(input.source),
    ...(subjectText === undefined ? {} : { subject: subjectText }),
    ...(input.traceparent === undefined ? {} : { traceparent: input.traceparent }),
    datacontenttype: "application/json",
    data,
  }

  const checked = validateEvent(event, catalogue)
  if (!checked.ok) throw new TypeError(`telemetry: ${eventType(declared.type, declared.version)} is not valid:\n- ${checked.problems.join("\n- ")}`)
  return checked.value
}
