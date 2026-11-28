// The schema bundle: every schema the package publishes, and the facts a plugin derives in code.
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { AUDIT_SCHEMA } from "../src/audit.ts"
import { HINT_SCHEMA } from "../src/hints.ts"
import { MANIFEST_SCHEMA } from "../src/manifest.ts"
import { OUTPUTS } from "../src/outputs.ts"
import { FACT_SCHEMAS } from "../src/internal/schema/facts.ts"
import { SCHEMAS } from "../src/schemas.ts"
import { TELEMETRY_EVENT_SCHEMA } from "../src/telemetry.ts"

describe("the published schema bundle", () => {
  test("every schema has a name a file can carry, and a JSON Schema", () => {
    assert.ok(SCHEMAS.length > 0)
    const names = SCHEMAS.map((schema) => schema.name)
    assert.equal(new Set(names).size, names.length)
    for (const schema of SCHEMAS) {
      assert.match(schema.name, /^[a-z][a-z0-9.-]*$/)
      assert.equal(typeof schema.jsonSchema(), "object")
    }
  })

  test("the manifest, the output shapes, the facts, the hint file, the audit report and the telemetry envelope are the bundle", () => {
    const names = new Set(SCHEMAS.map((schema) => schema.name))
    assert.ok(names.has(MANIFEST_SCHEMA.name))
    assert.ok(names.has(HINT_SCHEMA.name))
    assert.ok(names.has(AUDIT_SCHEMA.name))
    assert.ok(names.has(TELEMETRY_EVENT_SCHEMA.name))
    for (const output of Object.values(OUTPUTS)) assert.ok(names.has(output.name), output.name)
    for (const fact of Object.values(FACT_SCHEMAS)) assert.ok(names.has(fact.name), fact.name)
    // The old v0.3 `sources` block is gone: capabilities is the one manifest.
    assert.ok(!names.has("sources"))
  })
})

describe("the core facts", () => {
  test("the three types are declared, in the order the contract lists them", () => {
    assert.deepEqual(Object.keys(FACT_SCHEMAS), ["commitment", "person.attribute", "meeting.attended"])
  })

  test("a well-formed fact of each type validates, and a wrong one is refused", () => {
    assert.deepEqual(FACT_SCHEMAS.commitment.check({ type: "commitment", key: "k", title: "Send the report", owner: "slack:U01", state: "open" }), {
      ok: true,
      value: { type: "commitment", key: "k", title: "Send the report", owner: "slack:U01", state: "open" },
    })
    assert.equal(FACT_SCHEMAS.commitment.check({ type: "commitment", key: "k", title: "t", owner: "slack:U01", state: "later" }).ok, false)
    assert.equal(FACT_SCHEMAS["person.attribute"].check({ type: "person.attribute", actor: "slack:U01" }).ok, false)
    assert.equal(FACT_SCHEMAS["person.attribute"].check({ type: "person.attribute", actor: "slack:U01", team: "search" }).ok, true)
    assert.equal(FACT_SCHEMAS["meeting.attended"].check({ type: "meeting.attended", actor: "slack:U01", response: "accepted", organizer: false }).ok, true)
    assert.equal(FACT_SCHEMAS["meeting.attended"].check({ type: "meeting.attended", actor: "slack:U01", response: "maybe", organizer: false }).ok, false)
  })
})
