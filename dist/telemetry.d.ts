/**
 * `telemetry`: the one event envelope, the contract's catalogue of plugin events and the local event log (principles
 * rule 1.4, decision 0005, decision 0017).
 *
 *   const event = createEvent({ type: "plugin.read", source, subject, fields, traceparent })
 *   const log = createEventLog({ path })
 *   log.append(event)                         // validated, screened and fsynced, or a refusal
 *   validateEvent(event, TELEMETRY_CATALOGUE) // the envelope and the catalogue, or every problem
 *
 * The envelope is CloudEvents 1.0: `id`, `time`, `type`, `source`, `subject`, the distributed-tracing extension
 * `traceparent`, and `data` as fields, each carrying the class the catalogue declares. Audit events are marked in the
 * catalogue. The module captures; it exports nothing. `docs/telemetry.md` is the guide.
 */
export { catalogueEvent, catalogueEvents, eventType, PLUGIN_EVENT_TYPES, TELEMETRY_CATALOGUE, TELEMETRY_EVENT_CLASSES, TELEMETRY_FIELD_CLASSES, } from "./telemetry/definition.js";
export type { PluginEventType, TelemetryCatalogue, TelemetryEvent, TelemetryEventClass, TelemetryEventDefinition, TelemetryField, TelemetryFieldClass, TelemetryFieldValue, } from "./telemetry/definition.js";
export { createEvent } from "./telemetry/envelope.js";
export type { CreateEventInput, TelemetrySource } from "./telemetry/envelope.js";
export { createEventLog } from "./telemetry/log.js";
export type { EventLog, EventLogAppendResult, EventLogOptions } from "./telemetry/log.js";
export { TELEMETRY_EVENT_SCHEMA } from "./telemetry/schema.js";
export type { TelemetrySubject } from "./telemetry/subject.js";
export { validateEvent } from "./telemetry/validate.js";
