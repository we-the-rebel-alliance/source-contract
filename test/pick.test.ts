import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { MAX_PICK_PATHS, missingPaths, pick, pickProblems, pickProblemsForOutput } from "../src/pick.ts"

// The cases of Artifacts' `pickFields` and `missingFields` tests (src/providers/connector.test.ts), ported.
const OUTPUT = {
  threads: [
    { id: "thread-1", snippet: "Hello", historyId: "1" },
    { id: "thread-2", snippet: "Again", historyId: "2" },
  ],
  next: "cursor",
}

describe("pick", () => {
  test("keeps the picked paths in the data's own nesting", () => {
    assert.deepEqual(pick(OUTPUT, ["threads[].id", "threads[].snippet"]), {
      ok: true,
      data: { threads: [{ id: "thread-1", snippet: "Hello" }, { id: "thread-2", snippet: "Again" }] },
    })
  })

  test("maps over arrays of arrays", () => {
    const data = { groups: [{ rows: [{ id: "a", secret: "no" }, { id: "b", secret: "no" }] }, { rows: [{ id: "c", secret: "no" }] }] }
    assert.deepEqual(pick(data, ["groups[].rows[].id"]), { ok: true, data: { groups: [{ rows: [{ id: "a" }, { id: "b" }] }, { rows: [{ id: "c" }] }] } })
  })

  test("keeps null, terminal values and empty arrays whole", () => {
    assert.deepEqual(pick({ next: null }, ["next"]), { ok: true, data: { next: null } })
    assert.deepEqual(pick({ threads: [] }, ["threads[]"]), { ok: true, data: { threads: [] } })
    assert.deepEqual(pick({ next: "cursor" }, ["next"]), { ok: true, data: { next: "cursor" } })
  })

  test("leaves out a key an item does not have, and keeps the keys it has", () => {
    const data = {
      items: [
        { id: "a", summary: "Stand-up", location: "Room 1", secret: "no" },
        { id: "b", summary: "Lunch", secret: "no" },
        { id: "c", secret: "no" },
      ],
    }
    assert.deepEqual(pick(data, ["items[].id", "items[].summary", "items[].location"]), {
      ok: true,
      data: { items: [{ id: "a", summary: "Stand-up", location: "Room 1" }, { id: "b", summary: "Lunch" }, { id: "c" }] },
    })
  })

  test("leaves out a nested key an item does not have, keeping the item's place", () => {
    const data = {
      items: [
        { id: "a", organizer: { email: "ana@example.com", self: true }, attendees: [{ email: "ben@example.com" }, { self: true }] },
        { id: "b" },
      ],
    }
    assert.deepEqual(pick(data, ["items[].id", "items[].organizer.email", "items[].attendees[].email"]), {
      ok: true,
      data: { items: [{ id: "a", organizer: { email: "ana@example.com" }, attendees: [{ email: "ben@example.com" }, {}] }, { id: "b" }] },
    })
  })

  test("leaves out a path the data does not have at all", () => {
    assert.deepEqual(pick({}, ["items[].id"]), { ok: true, data: {} })
    assert.deepEqual(pick({ next: "cursor" }, ["items[].id", "next"]), { ok: true, data: { next: "cursor" } })
    assert.deepEqual(pick(OUTPUT, ["threads[].id", "threads[].missing"]), { ok: true, data: { threads: [{ id: "thread-1" }, { id: "thread-2" }] } })
  })

  test("leaves out a path that meets the wrong type, keeping an item it cannot enter as {}", () => {
    assert.deepEqual(pick({ threads: "not an array" }, ["threads[].id"]), { ok: true, data: {} })
    assert.deepEqual(pick({ threads: null }, ["threads[].id"]), { ok: true, data: {} })
    assert.deepEqual(pick({ thread: [{ id: "a" }] }, ["thread.id"]), { ok: true, data: {} })
    assert.deepEqual(pick({ start: "2026-11-13" }, ["start.dateTime"]), { ok: true, data: {} })
    assert.deepEqual(pick({ threads: [{ id: "a" }, null, "x"] }, ["threads[].id"]), { ok: true, data: { threads: [{ id: "a" }, {}, {}] } })
  })

  test("defines a key named __proto__ as data", () => {
    const data = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}')
    const picked = pick(data, ["__proto__.polluted", "a"])
    assert.equal(picked.ok, true)
    assert.equal(({} as Record<string, unknown>)["polluted"], undefined)
  })

  test("fails only for data that is not a JSON object", () => {
    assert.deepEqual(pick("not an object", ["next"]), { ok: false })
    assert.deepEqual(pick([{ id: "a" }], ["id"]), { ok: false })
    assert.deepEqual(pick(null, ["next"]), { ok: false })
  })
})

describe("missingPaths", () => {
  test("names each path that reaches nothing in the data", () => {
    const data = { items: [{ id: "a", location: "Room 1" }, { id: "b" }], start: "2026-11-13" }
    assert.deepEqual(missingPaths(data, ["items[].id", "items[].location", "items[].hangoutLink", "start.dateTime", "next"]), ["items[].hangoutLink", "start.dateTime", "next"])
  })

  test("does not name a path that maps over an empty list", () => {
    assert.deepEqual(missingPaths({ items: [] }, ["items[].id", "items[].attendees[].email"]), [])
    assert.deepEqual(missingPaths({ items: [{ attendees: [] }] }, ["items[].attendees[].email"]), [])
  })

  test("names every path for data that is not a JSON object", () => {
    assert.deepEqual(missingPaths("text", ["a", "b"]), ["a", "b"])
    assert.deepEqual(missingPaths(OUTPUT, ["threads[].id", "next"]), [])
  })
})

describe("pickProblems", () => {
  test("accepts paths of a registered output, optional keys included", () => {
    assert.deepEqual(pickProblemsForOutput("agenda", ["items[].title", "items[].start", "items[].location", "rangeEnd"]), [])
    assert.deepEqual(pickProblemsForOutput("table", ["rows[].anything", "columns[].key"]), [])
    assert.deepEqual(pickProblemsForOutput("metric", ["value", "delta.direction"]), [])
  })

  test("refuses a path the output cannot have, a map over a non-list and a step into a scalar", () => {
    assert.deepEqual(pickProblemsForOutput("agenda", ["items[].titel"]), ['pick[0] "items[].titel" is not a path of the output'])
    assert.equal(pickProblemsForOutput("agenda", ["rangeEnd[]"]).length, 1)
    assert.equal(pickProblemsForOutput("agenda", ["items.title"]).length, 1)
    assert.equal(pickProblemsForOutput("agenda", ["items[].title.length"]).length, 1)
  })

  test("checks the grammar, the limits and repeats", () => {
    assert.deepEqual(pickProblems("items"), ["pick must be a list of paths"])
    assert.deepEqual(pickProblems([]), ["pick must name at least one path"])
    assert.match(pickProblems(["a b"])[0]!, /must be dotted names/)
    assert.match(pickProblems(["a..b"])[0]!, /must be dotted names/)
    assert.match(pickProblems(["a", "a"])[0]!, /repeats a path/)
    assert.match(pickProblems(["x".repeat(201)])[0]!, /over 200/)
    assert.match(pickProblems(Array.from({ length: MAX_PICK_PATHS + 1 }, (_, i) => `p${i}`))[0]!, /over 50/)
    assert.deepEqual(pickProblemsForOutput("weather", ["a"]), ['"weather" is not a registered output'])
  })

  test("follows $ref, anyOf and records in any JSON Schema", () => {
    const schema = {
      $defs: { person: { type: "object", properties: { name: { type: "string" } }, additionalProperties: false } },
      type: "object",
      properties: {
        owner: { $ref: "#/$defs/person" },
        either: { anyOf: [{ type: "string" }, { type: "object", properties: { id: { type: "string" } } }] },
        tags: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
      },
      additionalProperties: false,
    }
    assert.deepEqual(pickProblems(["owner.name", "either.id", "tags.anything[]"], schema), [])
    assert.equal(pickProblems(["owner.age"], schema).length, 1)
    assert.equal(pickProblems(["nobody"], schema).length, 1)
  })
})
