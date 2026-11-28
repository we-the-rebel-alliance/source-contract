/**
 * The one telemetry catalogue of the plugin contract: every event type a plugin emits, its version, whether it is an
 * audit event, and the class of each field (principles rule 1.4, decision 0005, decision 0017 and
 * architecture/telemetry.md).
 *
 * A field's class is declared here, never chosen by a caller: `metadata` is a fact about the call, `personal` is a
 * person's data, and `content` is text a person or a provider wrote. An event whose record is who did what, with which
 * rights, is marked `class: "audit"`; an ordinary event is `class: "event"`.
 *
 * A type and version are one pair. A changed field, or a changed meaning, is a new version, so a reader never guesses.
 */

/** The classes a field may have: facts about the call, a person's data, or content. */
export const TELEMETRY_FIELD_CLASSES = ["metadata", "personal", "content"] as const
export type TelemetryFieldClass = (typeof TELEMETRY_FIELD_CLASSES)[number]

/** The classes an event may have. An audit event records who did what, with which rights. */
export const TELEMETRY_EVENT_CLASSES = ["event", "audit"] as const
export type TelemetryEventClass = (typeof TELEMETRY_EVENT_CLASSES)[number]

/** Every event type the contract declares, in the order the contract lists them. */
export const PLUGIN_EVENT_TYPES = [
  "plugin.read",
  "plugin.plan",
  "plugin.commit",
  "plugin.refused",
  "account.signed_in",
  "account.signed_out",
  "account.needs_sign_in",
] as const
export type PluginEventType = (typeof PLUGIN_EVENT_TYPES)[number]

/** One field a catalogue declares: its class, and whether an event may leave it out. */
export interface TelemetryField {
  readonly class: TelemetryFieldClass
  readonly optional?: boolean | undefined
}

/** One event type in a catalogue. */
export interface TelemetryEventDefinition {
  /** The event's name, such as `plugin.read`; its CloudEvents type adds `.v<version>`. */
  readonly type: string
  readonly version: number
  /** `audit` for who did what with which rights, otherwise `event`. */
  readonly class: TelemetryEventClass
  /** When it is emitted, in one line, for the catalogue page. */
  readonly note: string
  /** Every field, with the class a reader may rely on. */
  readonly fields: Readonly<Record<string, TelemetryField>>
}

/** A catalogue as a list of events, or an object with an `events` list. */
export type TelemetryCatalogue = readonly TelemetryEventDefinition[] | { readonly events: readonly TelemetryEventDefinition[] }

/** One field's value in an event: the catalogued class, and the value itself. */
export interface TelemetryFieldValue {
  readonly class: TelemetryFieldClass
  readonly value: unknown
}

/** One event in the CloudEvents 1.0 envelope. `data` is the catalogued field map. */
export interface TelemetryEvent {
  readonly specversion: "1.0"
  readonly id: string
  readonly time: string
  /** The event's catalogue name and version, such as `plugin.read.v1`. */
  readonly type: string
  /** `plugin://<component>/<version>/<deployment>`. */
  readonly source: string
  /** Pseudonymous ids, as `person=…;agent=…;session=…;trace=…`. */
  readonly subject?: string | undefined
  /** The W3C distributed-tracing extension, when the work has a trace. */
  readonly traceparent?: string | undefined
  readonly datacontenttype: "application/json"
  readonly data: Readonly<Record<string, TelemetryFieldValue>>
}

/** The CloudEvents type of a catalogue event: its name and version. */
export function eventType(name: string, version: number): string {
  return `${name}.v${version}`
}

/** The events a catalogue holds, whether it is a list or an object with an `events` list. */
export function catalogueEvents(catalogue: TelemetryCatalogue): readonly TelemetryEventDefinition[] {
  if ("events" in catalogue) return catalogue.events
  return catalogue
}

/** One declared event, or undefined when the catalogue does not declare it at that version. */
export function catalogueEvent(catalogue: TelemetryCatalogue, type: string, version: number): TelemetryEventDefinition | undefined {
  return catalogueEvents(catalogue).find((event) => event.type === type && event.version === version)
}

/** A closed, frozen event definition, so a catalogue cannot be changed under a reader. */
function declared(event: TelemetryEventDefinition): TelemetryEventDefinition {
  return Object.freeze({ ...event, fields: Object.freeze({ ...event.fields }) })
}

/** The fields every call through a door carries, whatever its class. */
const CALL_FIELDS = {
  method: { class: "metadata" },
  method_class: { class: "metadata" },
  effect: { class: "metadata" },
  account: { class: "metadata" },
  consumer: { class: "metadata" },
  allowed_by: { class: "metadata" },
  outcome: { class: "metadata" },
  duration_ms: { class: "metadata" },
} as const satisfies Readonly<Record<string, TelemetryField>>

/** The fields an account state change carries; a reason is optional because not every change has one. */
const ACCOUNT_FIELDS = {
  account: { class: "metadata" },
  state: { class: "metadata" },
  reason: { class: "metadata", optional: true },
} as const satisfies Readonly<Record<string, TelemetryField>>

/**
 * The contract's catalogue of plugin events. Every event records who did what with which rights, so every one is an
 * audit event; a field is metadata unless a later version declares otherwise.
 */
export const TELEMETRY_CATALOGUE: readonly TelemetryEventDefinition[] = Object.freeze([
  declared({
    type: "plugin.read",
    version: 1,
    class: "audit",
    note: "A read through a door returned, with the count of events and the provider's cost.",
    fields: {
      ...CALL_FIELDS,
      count: { class: "metadata" },
      cost_usd: { class: "metadata", optional: true },
    },
  }),
  declared({
    type: "plugin.plan",
    version: 1,
    class: "audit",
    note: "A planning call returned a plan, without writing anything.",
    fields: CALL_FIELDS,
  }),
  declared({
    type: "plugin.commit",
    version: 1,
    class: "audit",
    note: "A commit ran the plan it was given.",
    fields: CALL_FIELDS,
  }),
  declared({
    type: "plugin.refused",
    version: 1,
    class: "audit",
    note: "A call was refused before it reached the provider, with the code that explains why.",
    fields: CALL_FIELDS,
  }),
  declared({
    type: "account.signed_in",
    version: 1,
    class: "audit",
    note: "An account signed in and became ready.",
    fields: ACCOUNT_FIELDS,
  }),
  declared({
    type: "account.signed_out",
    version: 1,
    class: "audit",
    note: "An account signed out.",
    fields: ACCOUNT_FIELDS,
  }),
  declared({
    type: "account.needs_sign_in",
    version: 1,
    class: "audit",
    note: "An account needs a person to sign in again.",
    fields: ACCOUNT_FIELDS,
  }),
])
