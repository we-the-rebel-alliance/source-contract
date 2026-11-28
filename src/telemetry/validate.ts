/**
 * One event against one catalogue: the envelope, then the catalogue's exact fields and classes, then the secret screen.
 *
 * `validateEvent` is the gate every event passes before a log writes it and before a test compares it with its
 * catalogue. It refuses an unknown type, a field the catalogue declares but the event leaves out, a field the event
 * carries but the catalogue does not declare (so it has no class), a field whose class differs from the catalogue, a
 * malformed or mismatched trace, and any value the contract's secret screen flags. A refusal names paths and kinds,
 * never a value, so it cannot echo a secret.
 */
import type { Checked } from "../internal/checked.ts"
import { secretKinds } from "../internal/secrets.ts"
import {
  catalogueEvents,
  TELEMETRY_CATALOGUE,
  TELEMETRY_EVENT_CLASSES,
  TELEMETRY_FIELD_CLASSES,
  type TelemetryCatalogue,
  type TelemetryEvent,
} from "./definition.ts"
import { TELEMETRY_EVENT_SCHEMA } from "./schema.ts"
import { parseSubject, traceIdOf } from "./subject.ts"

/** A field name that says only a credential could sit under it. */
const SECRET_NAME =
  /^(?:(?:api|access|secret|private|signing|session)[_-]?key|apikey|secret|client[_-]?secret|password|passwd|passphrase|access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer|authorization|cookie|set[_-]?cookie|credentials?|private[_-]?key)$/i

/** The secret screen's findings in one value, or one problem that names the field and the kind, never the value. */
function secretProblems(event: TelemetryEvent): string[] {
  const problems: string[] = []
  const check = (value: unknown, where: string): void => {
    let text: string
    try {
      text = JSON.stringify(value)
    } catch {
      problems.push(`${where}: is not JSON`)
      return
    }
    const kind = secretKinds(text)[0]
    if (kind !== undefined) problems.push(`${where}: holds a ${kind}, and a secret is never captured`)
  }
  for (const [name, entry] of Object.entries(event.data)) {
    if (SECRET_NAME.test(name)) problems.push(`data.${name}: the field name is secret-shaped`)
    check(entry.value, `data.${name}`)
  }
  check(event.id, "id")
  check(event.source, "source")
  if (event.subject !== undefined) check(event.subject, "subject")
  return problems
}

/**
 * Validate one event against one catalogue (the contract's by default).
 *
 * The answer is the parsed event, or every problem, one sentence each. It never throws.
 */
export function validateEvent(event: unknown, catalogue: TelemetryCatalogue = TELEMETRY_CATALOGUE): Checked<TelemetryEvent> {
  const envelope = TELEMETRY_EVENT_SCHEMA.check(event)
  if (!envelope.ok) return envelope
  const parsed = envelope.value
  const problems: string[] = []

  const declared = catalogueEvents(catalogue).find((candidate) => `${candidate.type}.v${candidate.version}` === parsed.type)
  if (declared === undefined) {
    return { ok: false, problems: [`type: "${parsed.type}" is not in the catalogue`] }
  }
  if (!(TELEMETRY_EVENT_CLASSES as readonly string[]).includes(declared.class)) {
    problems.push(`catalogue.${declared.type}: "${String(declared.class)}" is not an event class`)
  }

  const fieldNames = new Set(Object.keys(declared.fields))
  for (const [name, field] of Object.entries(declared.fields)) {
    if (!(TELEMETRY_FIELD_CLASSES as readonly string[]).includes(field.class)) {
      problems.push(`catalogue.${declared.type}.${name}: "${String(field.class)}" is not a field class`)
    }
    if (!Object.hasOwn(parsed.data, name) && field.optional !== true) {
      problems.push(`data.${name}: is missing, and ${parsed.type} declares it`)
    }
  }
  for (const [name, entry] of Object.entries(parsed.data)) {
    const field = declared.fields[name]
    if (field === undefined || !fieldNames.has(name)) {
      problems.push(`data.${name}: is not declared in ${parsed.type}, so it has no class`)
      continue
    }
    if (entry.class !== field.class) {
      problems.push(`data.${name}: has class ${entry.class}, not ${field.class}`)
    }
  }

  const subject = parseSubject(parsed.subject)
  if (!subject.ok) {
    problems.push(...subject.problems)
  } else if (subject.value.trace !== undefined && parsed.traceparent !== undefined && subject.value.trace !== traceIdOf(parsed.traceparent)) {
    problems.push("subject.trace: names a different trace from traceparent")
  }

  problems.push(...secretProblems(parsed))
  return problems.length === 0 ? { ok: true, value: parsed } : { ok: false, problems }
}
