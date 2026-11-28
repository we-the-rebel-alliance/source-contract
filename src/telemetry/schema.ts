/**
 * The CloudEvents 1.0 envelope, as one validator (principles decision 0017).
 *
 * `TELEMETRY_EVENT_SCHEMA` checks the envelope itself: the attributes a CloudEvents reader needs, the source and
 * subject shapes, a W3C `traceparent`, and `data` as a map of `{ class, value }` entries whose class is one of the
 * contract's three field classes. It does not know an event's catalogue type; `validateEvent` adds that check.
 */
import * as z from "zod"
import type { Validator } from "../internal/checked.ts"
import { validator } from "../internal/validator.ts"
import { TELEMETRY_FIELD_CLASSES, type TelemetryEvent } from "./definition.ts"
import { isTraceparent } from "./subject.ts"

/** An event's name: `plugin.read`, `account.signed_in`. */
const EVENT_NAME = "[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+"
/** The CloudEvents type: the name and its integer version. */
const EVENT_TYPE = new RegExp(`^${EVENT_NAME}\\.v[1-9][0-9]*$`)
/** `plugin://<encoded component>/<encoded version>/<encoded deployment>`. */
const SOURCE = /^plugin:\/\/[^/\s?#]+\/[^/\s?#]+\/[^/\s?#]+$/
/** A field name: lowercase letters, digits and underscores. */
const FIELD_NAME = /^[a-z][a-z0-9_]*$/
/** An RFC 3339 UTC time, as `Date.prototype.toISOString` writes it. */
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const TRACEPARENT = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/
const SUBJECT_PART = "(?:person|agent|session|trace)=[^;=\\s]+"
const SUBJECT = new RegExp(`^${SUBJECT_PART}(?:;${SUBJECT_PART})*$`)

const field = z.strictObject({
  class: z.enum([...TELEMETRY_FIELD_CLASSES]),
  value: z.json(),
})

/** The envelope's schema, generated into `dist/schemas/telemetry.event.json`. */
const envelope = z.strictObject({
  specversion: z.literal("1.0"),
  id: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), { error: "must not carry a control character" }),
  time: z.string().regex(TIME, { error: "must be an ISO 8601 UTC time, such as 2026-11-28T10:00:00.000Z" }),
  type: z.string().regex(EVENT_TYPE, { error: "must be an event name and version, such as plugin.read.v1" }),
  source: z.string().regex(SOURCE, { error: "must be plugin://<component>/<version>/<deployment>" }),
  subject: z.string().regex(SUBJECT, { error: "must be person=…;agent=…;session=…;trace=…" }).optional(),
  traceparent: z
    .string()
    .regex(TRACEPARENT, { error: "must be a W3C traceparent" })
    .refine(isTraceparent, { error: "must name a real trace and span" })
    .optional(),
  datacontenttype: z.literal("application/json"),
  data: z.record(z.string().regex(FIELD_NAME, { error: "must be a lowercase field name" }), field),
})

/** The envelope of every telemetry event, as a `Validator<TelemetryEvent>`. */
export const TELEMETRY_EVENT_SCHEMA: Validator<TelemetryEvent> = validator("telemetry.event", envelope)
