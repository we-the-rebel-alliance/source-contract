# Telemetry

Every plugin emits its events in one envelope, into a local and durable log, and each deployment chooses where they
are exported (principles rule 1.4, decisions 0005 and 0017; contract §19). This module carries the envelope, the
contract's catalogue of plugin event types and the log. It captures; it never exports.

```ts
import {
  createEvent,
  createEventLog,
  TELEMETRY_CATALOGUE,
  validateEvent,
} from "@we-the-rebel-alliance/plugin-contract/telemetry"

const event = createEvent({
  type: "plugin.read",
  source: { component: "slack", version: "1.2.3", deployment: "work" },
  subject: { person: "person_p_…", agent: "agent_p_…", session: "session_p_…" },
  fields: {
    method: "events_list",
    method_class: "read",
    effect: "none",
    account: "work",
    consumer: "notes",
    allowed_by: "grant",
    outcome: "ok",
    duration_ms: 42,
    count: 12,
    cost_usd: 0.002,
  },
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
})

const log = createEventLog({ path: "/var/lib/slack-plugin/events.jsonl" })
log.append(event) // { ok: true, id } or a refusal
```

## The envelope

An event is CloudEvents 1.0.

| Field | What it holds |
|---|---|
| `specversion` | `1.0` |
| `id` | A unique id, a fresh UUID when `createEvent` makes it |
| `time` | When it happened, as an ISO 8601 UTC time |
| `type` | The event's name and version in the catalogue, such as `plugin.read.v1` |
| `source` | `plugin://<component>/<version>/<deployment>` |
| `subject` | Pseudonymous ids, as `person=…;agent=…;session=…;trace=…`; a part is left out when it is absent |
| `traceparent` | The W3C trace context, when the work has a trace |
| `datacontenttype` | `application/json` |
| `data` | The event's fields. Each is `{ class, value }`, and the class comes from the catalogue |

`subject.trace` and `traceparent` must name the same trace when both are present. A malformed `traceparent`, an all-zero
trace or span id, and a version of `ff` are refused. The subject carries pseudonyms only, never a raw id, an account, a
token or a provider's own identifier.

`createEvent` fills `id` and `time`, derives `source` from the component, its version and the deployment, and takes each
field's class from the catalogue. It throws on a type the catalogue does not declare, a missing or extra field, a
malformed trace and a value the secret screen refuses. `validateEvent` is the same check without the throw.

## The catalogue

Each catalogue entry declares its type, version, event class and every field's class:

```ts
{
  type: "plugin.read",
  version: 1,
  class: "audit",
  fields: {
    method: { class: "metadata" },
    // …
    cost_usd: { class: "metadata" },
  },
}
```

A field's class is one of:

| Class | Holds |
|---|---|
| `metadata` | A fact about the call, such as its method, account, outcome or duration |
| `personal` | A person's data |
| `content` | Text a person or a provider wrote |

An event's class is `event`, or `audit` for what records who did what, with which rights. Every event in the contract's
catalogue is an audit event. A class belongs to the catalogue, never to a caller, so an event cannot label content as
metadata.

The contract's catalogue holds:

| Type | When |
|---|---|
| `plugin.read` | A read returned, with the count of events and, when the provider reports it, the cost |
| `plugin.plan` | A planning call returned a plan, without writing anything |
| `plugin.commit` | A commit ran the plan it was given |
| `plugin.refused` | A call was refused before it reached the provider, with the code that explains why |
| `account.signed_in` | An account signed in and became ready |
| `account.signed_out` | An account signed out |
| `account.needs_sign_in` | An account needs a person to sign in again |

A changed field, or a changed meaning, is a new version of the type. A reader never guesses which version it holds.

## Validation

`validateEvent(event, catalogue)` answers `{ ok: true, value }` or `{ ok: false, problems }`. It refuses:

- a type the catalogue does not declare;
- a field the catalogue declares but the event leaves out;
- a field the event carries but the catalogue does not declare, so it has no class;
- a field whose class differs from the catalogue's;
- a subject whose trace differs from `traceparent`;
- any value the contract's secret screen flags, with the kind of secret and the field path, never the value.

`TELEMETRY_EVENT_SCHEMA` is the envelope alone, as a `Validator<TelemetryEvent>`, and is published as
`dist/schemas/telemetry.event.json`.

## The log

`createEventLog({ path })` writes one JSON line per event, and fsyncs the line before `append` answers. The log is local,
append-only and durable. It validates and screens every event before writing, and `append` never throws into the caller:

```ts
log.append(event) // { ok: true, id: "…" }
log.append(untrusted) // { ok: false, reason: "invalid", problems: ["…"] }
log.append(event) // { ok: false, reason: "unavailable" } when the disk cannot be written
```

The directory is created when it is missing, the file is created with mode `0600`, and the log has no default path: the
host gives the plugin one under its data directory. `read()` returns every complete event, oldest first; a torn last
line from a crash is skipped. The log does not rotate, retain or export: those are the deployment's choices, and an
exporter reads the file.

## Exports

| Export | Does |
|---|---|
| `TELEMETRY_CATALOGUE` | the contract's catalogue of plugin events |
| `PLUGIN_EVENT_TYPES`, `PluginEventType` | the catalogue's event names and their TypeScript type |
| `TELEMETRY_FIELD_CLASSES`, `TelemetryFieldClass` | the three field classes and their TypeScript type |
| `TELEMETRY_EVENT_CLASSES`, `TelemetryEventClass` | `event` and `audit`, and their TypeScript type |
| `TelemetryEventDefinition`, `TelemetryField`, `TelemetryEvent`, `TelemetryFieldValue`, `TelemetryCatalogue` | the catalogue, field, envelope and catalogue-input shapes |
| `TelemetrySubject`, `TelemetrySource` | the pseudonymous subject, and the component, version and deployment `source` names |
| `eventType` | the CloudEvents type of a catalogue name and version, such as `plugin.read.v1` |
| `catalogueEvent`, `catalogueEvents` | one declared event, or every event a catalogue holds |
| `TELEMETRY_EVENT_SCHEMA` | the CloudEvents 1.0 envelope as a `Validator<TelemetryEvent>` |
| `validateEvent` | one event against one catalogue: the parsed event, or every problem |
| `CreateEventInput`, `createEvent` | build one valid event, with each field's class taken from the catalogue |
| `EventLogOptions`, `EventLog`, `EventLogAppendResult`, `createEventLog` | the local JSON Lines log, what an append answers, and its reader |
