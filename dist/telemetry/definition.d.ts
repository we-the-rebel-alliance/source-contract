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
export declare const TELEMETRY_FIELD_CLASSES: readonly ["metadata", "personal", "content"];
export type TelemetryFieldClass = (typeof TELEMETRY_FIELD_CLASSES)[number];
/** The classes an event may have. An audit event records who did what, with which rights. */
export declare const TELEMETRY_EVENT_CLASSES: readonly ["event", "audit"];
export type TelemetryEventClass = (typeof TELEMETRY_EVENT_CLASSES)[number];
/** Every event type the contract declares, in the order the contract lists them. */
export declare const PLUGIN_EVENT_TYPES: readonly ["plugin.read", "plugin.plan", "plugin.commit", "plugin.refused", "account.signed_in", "account.signed_out", "account.needs_sign_in"];
export type PluginEventType = (typeof PLUGIN_EVENT_TYPES)[number];
/** One field a catalogue declares: its class, and whether an event may leave it out. */
export interface TelemetryField {
    readonly class: TelemetryFieldClass;
    readonly optional?: boolean | undefined;
}
/** One event type in a catalogue. */
export interface TelemetryEventDefinition {
    /** The event's name, such as `plugin.read`; its CloudEvents type adds `.v<version>`. */
    readonly type: string;
    readonly version: number;
    /** `audit` for who did what with which rights, otherwise `event`. */
    readonly class: TelemetryEventClass;
    /** When it is emitted, in one line, for the catalogue page. */
    readonly note: string;
    /** Every field, with the class a reader may rely on. */
    readonly fields: Readonly<Record<string, TelemetryField>>;
}
/** A catalogue as a list of events, or an object with an `events` list. */
export type TelemetryCatalogue = readonly TelemetryEventDefinition[] | {
    readonly events: readonly TelemetryEventDefinition[];
};
/** One field's value in an event: the catalogued class, and the value itself. */
export interface TelemetryFieldValue {
    readonly class: TelemetryFieldClass;
    readonly value: unknown;
}
/** One event in the CloudEvents 1.0 envelope. `data` is the catalogued field map. */
export interface TelemetryEvent {
    readonly specversion: "1.0";
    readonly id: string;
    readonly time: string;
    /** The event's catalogue name and version, such as `plugin.read.v1`. */
    readonly type: string;
    /** `plugin://<component>/<version>/<deployment>`. */
    readonly source: string;
    /** Pseudonymous ids, as `person=…;agent=…;session=…;trace=…`. */
    readonly subject?: string | undefined;
    /** The W3C distributed-tracing extension, when the work has a trace. */
    readonly traceparent?: string | undefined;
    readonly datacontenttype: "application/json";
    readonly data: Readonly<Record<string, TelemetryFieldValue>>;
}
/** The CloudEvents type of a catalogue event: its name and version. */
export declare function eventType(name: string, version: number): string;
/** The events a catalogue holds, whether it is a list or an object with an `events` list. */
export declare function catalogueEvents(catalogue: TelemetryCatalogue): readonly TelemetryEventDefinition[];
/** One declared event, or undefined when the catalogue does not declare it at that version. */
export declare function catalogueEvent(catalogue: TelemetryCatalogue, type: string, version: number): TelemetryEventDefinition | undefined;
/**
 * The contract's catalogue of plugin events. Every event records who did what with which rights, so every one is an
 * audit event; a field is metadata unless a later version declares otherwise.
 */
export declare const TELEMETRY_CATALOGUE: readonly TelemetryEventDefinition[];
