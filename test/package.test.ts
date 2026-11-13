import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import { CONTRACT_VERSION, SUPPORTED_CONTRACT_VERSIONS } from "../src/index.ts"
import { validator } from "../src/internal/validator.ts"
import * as z from "zod"

describe("the package", () => {
  test("implements contract version 1 and reads it", () => {
    assert.equal(CONTRACT_VERSION, 1)
    assert.ok(SUPPORTED_CONTRACT_VERSIONS.includes(CONTRACT_VERSION))
  })

  test("depends on nothing at run time", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
    assert.equal(pkg.dependencies, undefined)
    assert.equal(pkg.peerDependencies, undefined)
    assert.equal(pkg.optionalDependencies, undefined)
  })
})

describe("a validator", () => {
  const point = validator("point", z.object({ x: z.number(), label: z.string().optional() }).strict())

  test("parses a valid value", () => {
    assert.deepEqual(point.check({ x: 1 }), { ok: true, value: { x: 1 } })
    assert.deepEqual(point.parse({ x: 2, label: "two" }), { x: 2, label: "two" })
  })

  test("names every problem by its path", () => {
    const checked = point.check({ x: "one", y: 2 })
    assert.equal(checked.ok, false)
    if (checked.ok) return
    assert.ok(checked.problems.some((problem) => problem.startsWith("x: ")))
    assert.ok(checked.problems.some((problem) => problem.includes("y")))
    assert.throws(() => point.parse({}), /point: the value breaks the schema/)
  })

  test("generates JSON Schema", () => {
    const schema = point.jsonSchema()
    assert.equal(schema["type"], "object")
    assert.deepEqual(schema["required"], ["x"])
    assert.equal(schema["additionalProperties"], false)
  })
})
