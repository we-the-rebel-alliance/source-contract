// The telemetry module (principles rule 1.4, decision 0005, decision 0017): the CloudEvents envelope, the contract's
// catalogue and the local event log. The tests hold every catalogued type, the refusals the issue names (an unknown
// type, an unclassed field, a secret, a malformed traceparent), and an append that survives a reopen.
import assert from "node:assert/strict"
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import {
  catalogueEvents,
  createEvent,
  createEventLog,
  eventType,
  PLUGIN_EVENT_TYPES,
  TELEMETRY_CATALOGUE,
  TELEMETRY_EVENT_SCHEMA,
  validateEvent,
  type TelemetryEvent,
  type TelemetryEventDefinition,
  type TelemetrySubject,
} from "../src/telemetry.ts"

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
const SPAN_ID = "00f067aa0ba902b7"
const TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`

const SAMPLE: Readonly<Record<string, unknown>> = {
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
  state: "ready",
  reason: "the provider answered",
}

function source(): { component: string; version: string; deployment: string } {
  return { component: "slack", version: "1.2.3", deployment: "work" }
}

function subject(): TelemetrySubject {
  return {
    person: "person_p_abcdefghijklmnopqrstuv",
    agent: "agent_p_abcdefghijklmnopqrstuv",
    session: "session_p_abcdefghijklmnopqrstuv",
  }
}

/** One value for every field a definition declares, so a new field must bring its sample too. */
function fieldsOf(definition: TelemetryEventDefinition): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(definition.fields).map((name) => {
      if (!Object.hasOwn(SAMPLE, name)) throw new Error(`${definition.type}.${name}: the test has no sample value`)
      return [name, SAMPLE[name]]
    }),
  )
}

function eventOf(definition: TelemetryEventDefinition): TelemetryEvent {
  return createEvent({
    type: definition.type,
    version: definition.version,
    source: source(),
    subject: subject(),
    fields: fieldsOf(definition),
    traceparent: TRACEPARENT,
    time: "2026-11-28T10:00:00.000Z",
  })
}

function temporary(t: { after(fn: () => void): void }): string {
  const directory = mkdtempSync(join(tmpdir(), "plugin-contract-telemetry-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

describe("the contract's telemetry catalogue", () => {
  test("every type is declared once, versioned, and every field has a class", () => {
    const names = catalogueEvents(TELEMETRY_CATALOGUE).map((definition) => definition.type)
    assert.deepEqual(names, [...PLUGIN_EVENT_TYPES])

    const keys = catalogueEvents(TELEMETRY_CATALOGUE).map((definition) => eventType(definition.type, definition.version))
    assert.equal(new Set(keys).size, keys.length)
    for (const definition of catalogueEvents(TELEMETRY_CATALOGUE)) {
      assert.ok(Number.isInteger(definition.version) && definition.version >= 1, `${definition.type}: no version`)
      assert.ok(["event", "audit"].includes(definition.class), `${definition.type}: no event class`)
      assert.equal(definition.class, "audit", `${definition.type}: records who did what and is an audit event`)
      for (const [name, field] of Object.entries(definition.fields)) {
        assert.ok(["metadata", "personal", "content"].includes(field.class), `${definition.type}.${name}: no field class`)
      }
    }
  })

  test("a valid event of every catalogue type parses, and its fields carry the catalogue's classes", () => {
    for (const definition of catalogueEvents(TELEMETRY_CATALOGUE)) {
      const event = eventOf(definition)
      assert.equal(event.specversion, "1.0")
      assert.equal(event.type, eventType(definition.type, definition.version))
      assert.equal(event.source, "plugin://slack/1.2.3/work")
      assert.equal(event.datacontenttype, "application/json")
      assert.deepEqual(
        Object.fromEntries(Object.entries(event.data).map(([name, entry]) => [name, entry.class])),
        Object.fromEntries(Object.entries(definition.fields).map(([name, field]) => [name, field.class])),
      )
      assert.deepEqual(validateEvent(event, TELEMETRY_CATALOGUE), { ok: true, value: event })
      assert.equal(TELEMETRY_EVENT_SCHEMA.check(event).ok, true, definition.type)
    }
  })

  test("a read may leave out the provider's cost when none was reported", () => {
    const definition = catalogueEvents(TELEMETRY_CATALOGUE)[0]!
    const fields = fieldsOf(definition)
    delete fields["cost_usd"]
    const event = createEvent({
      type: definition.type,
      version: definition.version,
      source: source(),
      subject: subject(),
      fields,
      traceparent: TRACEPARENT,
      time: "2026-11-28T10:00:00.000Z",
    })
    assert.equal(Object.hasOwn(event.data, "cost_usd"), false)
    assert.equal(validateEvent(event, TELEMETRY_CATALOGUE).ok, true)
  })

  test("the envelope derives source and subject, and keeps the trace with them", () => {
    const definition = catalogueEvents(TELEMETRY_CATALOGUE)[0]!
    const event = eventOf(definition)
    assert.match(event.id, /^[0-9a-f-]{36}$/)
    assert.equal(event.time, "2026-11-28T10:00:00.000Z")
    assert.equal(
      event.subject,
      `person=person_p_abcdefghijklmnopqrstuv;agent=agent_p_abcdefghijklmnopqrstuv;session=session_p_abcdefghijklmnopqrstuv;trace=${TRACE_ID}`,
    )
    assert.equal(event.traceparent, TRACEPARENT)
    assert.deepEqual(event.data["method"], { class: "metadata", value: "events_list" })
  })
})

describe("what validateEvent refuses", () => {
  const definition = catalogueEvents(TELEMETRY_CATALOGUE)[0]!
  const valid = eventOf(definition)

  test("an unknown type", () => {
    const checked = validateEvent({ ...valid, type: "plugin.unknown.v1" }, TELEMETRY_CATALOGUE)
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /type: "plugin\.unknown\.v1" is not in the catalogue/)
  })

  test("a missing field", () => {
    const data = { ...valid.data }
    delete data["method"]
    const checked = validateEvent({ ...valid, data }, TELEMETRY_CATALOGUE)
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /data\.method: is missing/)
  })

  test("a field the catalogue does not declare, so it has no class", () => {
    const checked = validateEvent(
      { ...valid, data: { ...valid.data, private_note: { class: "metadata", value: "not declared" } } },
      TELEMETRY_CATALOGUE,
    )
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /data\.private_note: is not declared .* so it has no class/)
  })

  test("a field whose class differs from the catalogue's", () => {
    const checked = validateEvent(
      { ...valid, data: { ...valid.data, method: { class: "content", value: "events_list" } } },
      TELEMETRY_CATALOGUE,
    )
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /data\.method: has class content, not metadata/)
  })

  test("a secret in a field, named by kind and path and never echoed", () => {
    const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
    const checked = validateEvent(
      { ...valid, data: { ...valid.data, method: { class: "metadata", value: token } } },
      TELEMETRY_CATALOGUE,
    )
    assert.equal(checked.ok, false)
    if (checked.ok) return
    const text = checked.problems.join("\n")
    assert.match(text, /data\.method: holds a token/)
    assert.equal(text.includes(token), false)
  })

  test("a malformed traceparent", () => {
    const malformed = [
      `00-${TRACE_ID}-${SPAN_ID}-0`,
      `00-${TRACE_ID.toUpperCase()}-${SPAN_ID}-01`,
      `ff-${TRACE_ID}-${SPAN_ID}-01`,
      `00-${"0".repeat(32)}-${SPAN_ID}-01`,
      `00-${TRACE_ID}-${"0".repeat(16)}-01`,
      "00-abc-def-01",
    ]
    for (const traceparent of malformed) {
      const checked = validateEvent({ ...valid, traceparent }, TELEMETRY_CATALOGUE)
      assert.equal(checked.ok, false, traceparent)
      if (!checked.ok) assert.match(checked.problems.join("\n"), /traceparent/)
      assert.throws(() => eventOfWith(definition, { traceparent }), /traceparent/)
    }
  })

  test("a subject trace that differs from traceparent", () => {
    const other = "1".repeat(32)
    const checked = validateEvent({ ...valid, subject: `person=person_p_example;trace=${other}` }, TELEMETRY_CATALOGUE)
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /subject\.trace: names a different trace from traceparent/)
  })

  test("a malformed envelope, before the catalogue is reached", () => {
    const checked = validateEvent({ ...valid, specversion: "0.3" }, TELEMETRY_CATALOGUE)
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.match(checked.problems.join("\n"), /specversion/)
  })
})

/** A valid event with one createEvent input replaced, for the refusals that throw at build time. */
function eventOfWith(definition: TelemetryEventDefinition, overrides: Partial<Parameters<typeof createEvent>[0]>): TelemetryEvent {
  return createEvent({
    type: definition.type,
    version: definition.version,
    source: source(),
    subject: subject(),
    fields: fieldsOf(definition),
    traceparent: TRACEPARENT,
    time: "2026-11-28T10:00:00.000Z",
    ...overrides,
  })
}

describe("the local event log", () => {
  test("appends every catalogue type, and a reopened log reads them back", (t) => {
    const path = join(temporary(t), "events.jsonl")
    const log = createEventLog({ path })
    const events = catalogueEvents(TELEMETRY_CATALOGUE).map(eventOf)

    for (const event of events) assert.deepEqual(log.append(event), { ok: true, id: event.id })
    assert.deepEqual(createEventLog({ path }).read(), events)
  })

  test("refuses an invalid event and a secret before it writes, without throwing", (t) => {
    const path = join(temporary(t), "events.jsonl")
    const log = createEventLog({ path })
    const valid = eventOf(catalogueEvents(TELEMETRY_CATALOGUE)[0]!)

    const unknown = log.append({ ...valid, type: "plugin.unknown.v1" })
    assert.equal(unknown.ok, false)
    if (!unknown.ok) assert.equal(unknown.reason, "invalid")

    const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
    const secret = log.append({ ...valid, data: { ...valid.data, method: { class: "metadata", value: token } } })
    assert.equal(secret.ok, false)
    if (!secret.ok) {
      assert.equal(secret.reason, "invalid")
      assert.equal(secret.problems.join("\n").includes(token), false)
    }

    assert.deepEqual(log.read(), [])
  })

  test("a path the disk cannot write answers unavailable and never throws", (t) => {
    const directory = temporary(t)
    const blocker = join(directory, "not-a-directory")
    writeFileSync(blocker, "a file where a directory would be")
    const log = createEventLog({ path: join(blocker, "events.jsonl") })
    const event = eventOf(catalogueEvents(TELEMETRY_CATALOGUE)[0]!)
    assert.deepEqual(log.append(event), { ok: false, reason: "unavailable" })
  })

  test("a torn last line is skipped, and the next append repairs it before writing", (t) => {
    const path = join(temporary(t), "events.jsonl")
    const log = createEventLog({ path })
    const first = eventOf(catalogueEvents(TELEMETRY_CATALOGUE)[0]!)
    assert.equal(log.append(first).ok, true)
    appendFileSync(path, '{"specversion":"1.0","id":"torn')

    assert.deepEqual(log.read(), [first])
    assert.deepEqual(createEventLog({ path }).read(), [first])

    const second = eventOf(catalogueEvents(TELEMETRY_CATALOGUE)[1]!)
    assert.equal(log.append(second).ok, true)
    assert.deepEqual(log.read(), [first, second])
  })
})
