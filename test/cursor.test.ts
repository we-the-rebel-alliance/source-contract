// The cursor codec: contract 1's version 1, byte for byte, and the bound version 2.
import { describe, test } from "node:test"
import { expect } from "./support/expect.ts"
import { bindingHash, canonicalScope, decodeBoundCursor, decodeCursor, encodeBoundCursor, encodeCursor, MAX_CURSOR_LENGTH, type CursorBinding } from "../src/cursor.ts"

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
const BINDING: CursorBinding = { plugin: "opencode-gws", source: "gmail", account: "personal", scope: { label: ["INBOX", "IMPORTANT"] } }
/** The same binding with no scope: the whole source. */
const WHOLE: CursorBinding = { plugin: BINDING.plugin, source: BINDING.source, account: BINDING.account }

describe("version 1 (contract 1)", () => {
  test("writes exactly what events-list.ts wrote: the state, then v and s", () => {
    expect(encodeCursor("demo", { n: 3, id: "x" })).toBe(b64({ n: 3, id: "x", v: 1, s: "demo" }))
    expect(decodeCursor("demo", b64({ n: 3, v: 1, s: "demo" }))).toEqual({ n: 3 })
  })

  test("refuses another source's, another version's, and a malformed cursor", () => {
    const cursor = encodeCursor("demo", { n: 1 })
    expect(decodeCursor("other", cursor)).toBeUndefined()
    for (const bad of ["", "not a cursor", "bm90LWpzb24", b64({ v: 2, s: "demo" }), b64([1, 2]), "a".repeat(MAX_CURSOR_LENGTH + 1)]) expect(decodeCursor("demo", bad), bad).toBeUndefined()
  })
})

describe("version 2, bound to (plugin, source, account, scope)", () => {
  test("round-trips its state", () => {
    const cursor = encodeBoundCursor(BINDING, { h: "1010", t: 1793545200000 })
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeBoundCursor(BINDING, cursor)).toEqual({ ok: true, state: { h: "1010", t: 1793545200000 }, legacy: false })
  })

  test("is foreign to another plugin, source, account or scope", () => {
    const cursor = encodeBoundCursor(BINDING, { n: 1 })
    for (const other of [
      { ...BINDING, plugin: "opencode-gws-fork" },
      { ...BINDING, source: "calendar" },
      { ...BINDING, account: "work" },
      { ...BINDING, scope: { label: ["INBOX"] } },
      WHOLE,
    ]) {
      expect(decodeBoundCursor(other, cursor), JSON.stringify(other)).toEqual({ ok: false, reason: "foreign" })
    }
  })

  test("binds the scope in canonical form: key and value order and repeats do not matter, a string and a list differ", () => {
    const reordered = { ...BINDING, scope: { label: ["IMPORTANT", "INBOX", "INBOX"] } }
    expect(bindingHash(reordered)).toBe(bindingHash(BINDING))
    expect(decodeBoundCursor(reordered, encodeBoundCursor(BINDING, { n: 1 })).ok).toBe(true)
    expect(canonicalScope({ b: ["y", "x", "x"], a: "z" })).toEqual({ a: "z", b: ["x", "y"] })
    expect(JSON.stringify(canonicalScope({ b: "1", a: "2" }))).toBe('{"a":"2","b":"1"}')
    expect(bindingHash({ ...BINDING, scope: { label: "INBOX" } })).not.toBe(bindingHash({ ...BINDING, scope: { label: ["INBOX"] } }))
    expect(bindingHash({ ...BINDING, scope: {} })).toBe(bindingHash(WHOLE))
    expect(() => canonicalScope({ a: 1 } as never)).toThrow(/string or a list of strings/)
  })

  test("is malformed when it is not base64url JSON of an object", () => {
    for (const bad of ["", "not a cursor", "%%%", b64("text"), "a".repeat(MAX_CURSOR_LENGTH + 1)]) expect(decodeBoundCursor(BINDING, bad), bad).toEqual({ ok: false, reason: "malformed" })
  })

  test("refuses a version 1 cursor unless acceptV1, and then only the same source's, marked legacy", () => {
    const v1 = encodeCursor("gmail", { a: "personal", h: "1010" })
    expect(decodeBoundCursor(BINDING, v1)).toEqual({ ok: false, reason: "foreign" })
    expect(decodeBoundCursor(BINDING, v1, { acceptV1: true })).toEqual({ ok: true, state: { a: "personal", h: "1010" }, legacy: true })
    expect(decodeBoundCursor(BINDING, encodeCursor("slack", {}), { acceptV1: true })).toEqual({ ok: false, reason: "foreign" })
  })

  test("refuses a reserved state key, and a cursor over 1024 characters, as bugs in the source", () => {
    for (const key of ["v", "s", "b"]) expect(() => encodeBoundCursor(BINDING, { [key]: 1 })).toThrow(/reserved/)
    expect(() => encodeBoundCursor(BINDING, { pad: "x".repeat(1_000) })).toThrow(/over 1024/)
  })
})
