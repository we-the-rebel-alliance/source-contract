import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkOutput, IMAGE_DATA_URI_MAX, isOutputName, OUTPUT_NAMES, OUTPUTS, outputValidator } from "../src/registry.ts"

/** One valid `data` per registered output: what a source answers, and what a project renders. */
const VALID: Record<string, unknown> = {
  agenda: {
    items: [
      { id: "evt-1", title: "Stand-up", start: "2026-11-13T09:00:00+01:00", end: "2026-11-13T09:15:00+01:00", joinUrl: "https://meet.example.com/abc" },
      { id: "evt-2", title: "Holiday", start: "2026-11-14", allDay: true },
    ],
    rangeEnd: "2026-11-14T00:00:00Z",
  },
  inbox: { unread: 3, items: [{ id: "m1", title: "Invoice", from: "Ana", at: "2026-11-13T08:00:00Z", important: true }] },
  metric: { label: "Open issues", value: 12, delta: { value: -2, direction: "down", good: true }, spark: [14, 13, 12] },
  list: { items: [{ id: "a", text: "Book travel", done: false, due: "2026-11-20" }], editable: false },
  progress: { label: "Sprint", value: 6, max: 10, steps: [{ label: "Plan", done: true }] },
  note: { markdown: "**Remember** the review." },
  links: { items: [{ id: "l1", title: "Runbook", url: "https://example.com/runbook" }] },
  countdown: { label: "Launch", target: "2026-12-01T09:00:00Z", style: "relative" },
  image: { dataUri: "data:image/png;base64,iVBORw0KGgo=", alt: "A chart" },
  thread: { subject: "Budget", messages: [{ id: "1", from: "Ana", at: "2026-11-13T08:00:00Z", body: "Agreed." }] },
  table: { columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ana" }, { name: null }] },
  record: { title: "Ticket 42", fields: [{ label: "State", value: "Open" }] },
}

describe("the output registry", () => {
  test("holds jelly's Home templates, with thread, table and record", () => {
    assert.deepEqual(OUTPUT_NAMES, ["agenda", "inbox", "metric", "list", "progress", "note", "links", "countdown", "image", "thread", "table", "record"])
  })

  for (const name of Object.keys(VALID)) {
    test(`accepts a valid ${name}`, () => {
      assert.deepEqual(checkOutput(name, VALID[name]), { ok: true, value: VALID[name] })
    })
  }

  test("refuses unknown keys, wrong types and http links, naming the path", () => {
    const checked = checkOutput("agenda", { items: [{ id: "x", title: "T", start: "tomorrow", url: "http://example.com", extra: 1 }] })
    assert.equal(checked.ok, false)
    if (checked.ok) return
    const text = checked.problems.join("\n")
    assert.match(text, /items\[0\]\.start/)
    assert.match(text, /items\[0\]\.url: must be an https URL/)
    assert.match(text, /extra/)
  })

  test("checks the rules a shape cannot say: progress within its maximum, exactly one image source", () => {
    assert.equal(checkOutput("progress", { label: "x", value: 11, max: 10 }).ok, false)
    assert.equal(checkOutput("image", { alt: "x" }).ok, false)
    assert.equal(checkOutput("image", { alt: "x", url: "https://example.com/a.png", dataUri: "data:image/png;base64,AA==" }).ok, false)
    assert.equal(checkOutput("image", { alt: "x", url: "https://example.com/a.png" }).ok, true)
  })

  test("caps an image's data URI so the whole answer fits in the 1 MB a source's maxBytes allows", () => {
    const prefix = "data:image/jpeg;base64,"
    const fits = `${prefix}${"A".repeat(IMAGE_DATA_URI_MAX - prefix.length)}`
    assert.equal(checkOutput("image", { alt: "x", dataUri: fits }).ok, true)
    assert.equal(checkOutput("image", { alt: "x", dataUri: `${fits}AAAA` }).ok, false)
    const answer = { source: "images", account: "ana@example.com", data: { alt: "x".repeat(200), caption: "c".repeat(120), dataUri: fits }, asOf: "2026-11-13T09:41:00Z", trust: "untrusted" }
    assert.ok(new TextEncoder().encode(JSON.stringify(answer)).length <= 1024 * 1024)
  })

  test("answers a name it does not hold with a problem, not a throw", () => {
    assert.equal(isOutputName("agenda"), true)
    assert.equal(isOutputName("weather"), false)
    assert.equal(isOutputName("constructor"), false)
    assert.equal(outputValidator("weather"), undefined)
    const checked = checkOutput("weather", {})
    assert.equal(checked.ok, false)
    if (!checked.ok) assert.match(checked.problems[0]!, /"weather" is not a registered output/)
  })

  test("publishes each as JSON Schema", () => {
    for (const [name, output] of Object.entries(OUTPUTS)) {
      assert.equal(output.name, `output.${name}`)
      assert.equal(output.jsonSchema()["type"], "object")
    }
  })
})
