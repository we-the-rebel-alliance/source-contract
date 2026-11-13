import assert from "node:assert/strict"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { canonicalJson, checkSources, descriptorHash, findInstalledPackage, findSource, maxBytesOf, readInstalledDescriptor } from "../src/descriptor.ts"
import type { Checked } from "../src/index.ts"

const problemsIn = (checked: Checked<unknown>): readonly string[] => (checked.ok ? [] : checked.problems)

const examples = fileURLToPath(new URL("./descriptors/", import.meta.url))
const exampleSources = (name: string) => JSON.parse(readFileSync(join(examples, name, "package.json"), "utf8")).sources
const scratch = mkdtempSync(join(tmpdir(), "descriptor-test-"))
after(() => rmSync(scratch, { recursive: true, force: true }))

/** A copy of the gws example's sources with one item changed. */
function withItem(change: (item: Record<string, any>) => void, index = 0) {
  const sources = structuredClone(exampleSources("gws"))
  change(sources.items[index])
  return sources
}

const problemsOf = (value: unknown) => {
  const checked = checkSources(value)
  return checked.ok ? [] : [...checked.problems]
}

describe("the examples", () => {
  for (const name of ["gws", "slack"]) {
    test(`${name} reads from disk, validates and hashes`, () => {
      const installed = readInstalledDescriptor(join(examples, name), { version: "0.0.0-example" })
      assert.equal(installed.ok, true, installed.ok ? "" : installed.problems.join("\n"))
      if (!installed.ok) return
      assert.match(installed.value.hash, /^sha256:[0-9a-f]{64}$/)
      assert.equal(installed.value.version, "0.0.0-example")
    })
  }

  test("gws declares Gmail and Calendar today, as the design writes them", () => {
    const installed = readInstalledDescriptor(join(examples, "gws"))
    assert.ok(installed.ok)
    const today = findSource(installed.value.sources, "gws.calendar.today")
    assert.equal(today?.output, "agenda")
    assert.equal(maxBytesOf(today!), 65536)
    assert.equal(findSource(installed.value.sources, "gws.gmail")?.reads, "message")
    assert.equal(findSource(installed.value.sources, "gws.nothing"), undefined)
  })
})

describe("readInstalledDescriptor", () => {
  test("refuses another version than the install names, a package with no sources, and no package", () => {
    assert.match(problemsIn(readInstalledDescriptor(join(examples, "gws"), { version: "9.9.9" }))[0]!, /is version 0.0.0-example, not the 9.9.9/)
    const bare = join(scratch, "bare")
    mkdirSync(bare)
    writeFileSync(join(bare, "package.json"), JSON.stringify({ name: "bare", version: "1.0.0" }))
    assert.match(problemsIn(readInstalledDescriptor(bare))[0]!, /declares no sources/)
    assert.match(problemsIn(readInstalledDescriptor(join(scratch, "missing")))[0]!, /there is no package.json there/)
    writeFileSync(join(bare, "package.json"), "{ not json")
    assert.match(problemsIn(readInstalledDescriptor(bare))[0]!, /is not JSON/)
  })

  test("finds a package installed above a directory, as Node would", () => {
    const project = join(scratch, "project")
    const target = join(project, "node_modules", "@joe-broadhead", "opencode-gws")
    mkdirSync(target, { recursive: true })
    cpSync(join(examples, "gws", "package.json"), join(target, "package.json"))
    const deep = join(project, "src", "deep")
    mkdirSync(deep, { recursive: true })
    assert.equal(findInstalledPackage("@joe-broadhead/opencode-gws", deep), target)
    assert.equal(findInstalledPackage("@joe-broadhead/opencode-none", deep), undefined)
    assert.equal(findInstalledPackage("../escape", deep), undefined)
  })
})

describe("the hash", () => {
  test("does not change with key order, and changes with any value", () => {
    const sources = exampleSources("gws")
    const reordered = JSON.parse(canonicalJson(sources))
    assert.equal(descriptorHash(reordered), descriptorHash(sources))
    assert.notEqual(descriptorHash(withItem((item) => item.permission.operations.push("gmail.users.threads.get"))), descriptorHash(sources))
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}')
  })
})

describe("the frame", () => {
  test("requires permission.operations", () => {
    assert.match(problemsOf(withItem((item) => (item.permission.operations = []))).join("\n"), /items\[0\]\.permission\.operations/)
    assert.match(problemsOf(withItem((item) => delete item.permission.operations)).join("\n"), /permission\.operations/)
  })

  test("requires a snapshot's output to be registered, and an events source's event kind", () => {
    assert.match(problemsOf(withItem((item) => (item.output = "weather"), 1)).join("\n"), /"weather" is not a registered output/)
    assert.match(problemsOf(withItem((item) => delete item.output, 1)).join("\n"), /items\[1\]\.output/)
    assert.match(problemsOf(withItem((item) => delete item.reads)).join("\n"), /items\[0\]\.reads/)
    assert.match(problemsOf(withItem((item) => (item.output = "agenda"))).join("\n"), /items\[0\]\.output: an events source has no output/)
  })

  test("caps maxBytes at 1 MB and needs price units for a billed source", () => {
    assert.match(problemsOf(withItem((item) => (item.maxBytes = 2 * 1024 * 1024))).join("\n"), /items\[0\]\.maxBytes.*1048576/)
    assert.match(problemsOf(withItem((item) => (item.cost = { class: "billed" }))).join("\n"), /items\[0\]\.cost\.units/)
    assert.deepEqual(problemsOf(withItem((item) => (item.cost = { class: "billed", units: [{ per: "post", usd: 0.005 }], probe: { per: "call", usd: 0.01 } }))), [])
  })

  test("takes a detail read's input only from the event's identifying fields, never its text", () => {
    const text = exampleSources("slack")
    text.items[0].details[0].from = ["text"]
    assert.match(problemsOf(text).join("\n"), /details\[0\]\.from/)
    const title = exampleSources("slack")
    title.items[0].details[0].from = ["thread", "title"]
    assert.ok(problemsOf(title).length > 0)
    assert.deepEqual(problemsOf(exampleSources("slack")), [])
  })

  test("needs a cost on every source", () => {
    assert.match(problemsOf(withItem((item) => delete item.cost)).join("\n"), /cost/)
  })

  test("refuses a repeated id, an unknown contract version, and a wrong id", () => {
    const twice = exampleSources("gws")
    twice.items[1].id = "gws.gmail"
    assert.match(problemsOf(twice).join("\n"), /"gws.gmail" is declared twice/)
    assert.match(problemsOf({ ...exampleSources("gws"), contractVersion: 2 }).join("\n"), /sources\.contractVersion/)
    assert.match(problemsOf(withItem((item) => (item.id = "Gmail"))).join("\n"), /items\[0\]\.id: must be a dotted source id/)
    assert.deepEqual(problemsOf(undefined), ["sources: Invalid input: expected object, received undefined"])
  })

  test("runs Memory's schema first, which refuses a key it does not define", () => {
    assert.match(problemsOf(withItem((item) => (item.title = "Gmail"))).join("\n"), /Unrecognized key: "title"/)
  })
})
