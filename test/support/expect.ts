/**
 * The subset of vitest's `expect` the family's suites use, over `node:assert`, so a suite copied from a plugin runs on
 * `node --test` and `bun test` alike with only its imports changed. Asymmetric matchers: `expect.any`,
 * `expect.stringMatching`, `expect.stringContaining`, `expect.objectContaining`. Equality is vitest's `toEqual`:
 * recursive, and a property whose value is undefined counts as absent.
 */
import { AssertionError } from "node:assert"
import { inspect } from "node:util"

const ASYMMETRIC = Symbol("asymmetric")

interface Asymmetric {
  readonly [ASYMMETRIC]: true
  matches(value: unknown): boolean
  toString(): string
}

const asymmetric = (description: string, matches: (value: unknown) => boolean): Asymmetric => ({ [ASYMMETRIC]: true, matches, toString: () => description })
const isAsymmetric = (value: unknown): value is Asymmetric => typeof value === "object" && value !== null && ASYMMETRIC in value
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** Deep equality, as vitest's toEqual; with `subset`, as toMatchObject (every expected key, recursively). */
function equals(actual: unknown, expected: unknown, subset: boolean): boolean {
  if (isAsymmetric(expected)) return expected.matches(actual)
  if (Object.is(actual, expected)) return true
  if (expected instanceof RegExp) return actual instanceof RegExp && String(actual) === String(expected)
  if (expected instanceof Set) {
    if (!(actual instanceof Set) || actual.size !== expected.size) return false
    return [...expected].every((item) => [...actual].some((other) => equals(other, item, false)))
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false
    return expected.every((item, index) => equals(actual[index], item, subset))
  }
  if (isObject(expected)) {
    if (!isObject(actual) || Array.isArray(actual)) return false
    const keys = Object.keys(expected).filter((key) => expected[key] !== undefined)
    if (!subset) {
      const actualKeys = Object.keys(actual).filter((key) => actual[key] !== undefined)
      if (actualKeys.length !== keys.length) return false
    }
    return keys.every((key) => Object.hasOwn(actual, key) && equals(actual[key], expected[key], subset))
  }
  return false
}

const show = (value: unknown) => inspect(value, { depth: 6, breakLength: 120 })

function fail(message: string, actual: unknown, expected: unknown): never {
  throw new AssertionError({ message, actual, expected })
}

interface Matchers {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toMatchObject(expected: unknown): void
  toContain(expected: unknown): void
  toContainEqual(expected: unknown): void
  toHaveLength(expected: number): void
  toMatch(expected: RegExp | string): void
  toBeUndefined(): void
  toBeGreaterThan(expected: number): void
  toBeLessThan(expected: number): void
  toBeLessThanOrEqual(expected: number): void
  toThrow(expected?: RegExp | string): void
}

interface AsyncMatchers {
  toThrow(expected?: RegExp | string): Promise<void>
  toBe(expected: unknown): Promise<void>
}

function matchers(actual: unknown, negate: boolean, label?: string): Matchers {
  const where = label ? ` (${label})` : ""
  const check = (pass: boolean, message: string, expected?: unknown) => {
    if (pass === negate) fail(`${negate ? "not: " : ""}${message}${where}`, actual, expected)
  }
  return {
    toBe: (expected) => check(Object.is(actual, expected), `expected ${show(actual)} to be ${show(expected)}`, expected),
    toEqual: (expected) => check(equals(actual, expected, false), `expected ${show(actual)} to equal ${show(expected)}`, expected),
    toMatchObject: (expected) => check(equals(actual, expected, true), `expected ${show(actual)} to match ${show(expected)}`, expected),
    toContain: (expected) =>
      check(typeof actual === "string" ? actual.includes(String(expected)) : Array.isArray(actual) && actual.includes(expected), `expected ${show(actual)} to contain ${show(expected)}`, expected),
    toContainEqual: (expected) => check(Array.isArray(actual) && actual.some((item) => equals(item, expected, false)), `expected ${show(actual)} to contain an item equal to ${show(expected)}`, expected),
    toHaveLength: (expected) => check(isObject(actual) || typeof actual === "string" ? (actual as { length?: number }).length === expected : false, `expected length ${expected}, got ${show((actual as { length?: number })?.length)}`, expected),
    toMatch: (expected) => check(typeof actual === "string" && (typeof expected === "string" ? actual.includes(expected) : expected.test(actual)), `expected ${show(actual)} to match ${String(expected)}`, expected),
    toBeUndefined: () => check(actual === undefined, `expected ${show(actual)} to be undefined`),
    toBeGreaterThan: (expected) => check(typeof actual === "number" && actual > expected, `expected ${show(actual)} > ${expected}`, expected),
    toBeLessThan: (expected) => check(typeof actual === "number" && actual < expected, `expected ${show(actual)} < ${expected}`, expected),
    toBeLessThanOrEqual: (expected) => check(typeof actual === "number" && actual <= expected, `expected ${show(actual)} <= ${expected}`, expected),
    toThrow: (expected) => {
      if (typeof actual !== "function") fail("toThrow needs a function", actual, expected)
      let thrown: unknown
      let threw = false
      try {
        ;(actual as () => unknown)()
      } catch (error) {
        threw = true
        thrown = error
      }
      check(threw && messageMatches(thrown, expected), `expected the function to throw${expected === undefined ? "" : ` ${String(expected)}`}, it ${threw ? `threw ${show(thrown)}` : "did not throw"}`, expected)
    },
  }
}

function messageMatches(error: unknown, expected: RegExp | string | undefined): boolean {
  if (expected === undefined) return true
  const message = error instanceof Error ? error.message : String(error)
  return typeof expected === "string" ? message.includes(expected) : expected.test(message)
}

export interface Expect extends Matchers {
  readonly not: Matchers
  readonly rejects: AsyncMatchers
}

export function expect(actual: unknown, label?: string): Expect {
  return {
    ...matchers(actual, false, label),
    not: matchers(actual, true, label),
    rejects: {
      async toThrow(expected) {
        try {
          await (actual as Promise<unknown>)
        } catch (error) {
          if (!messageMatches(error, expected)) fail(`expected a rejection matching ${String(expected)}, got ${show(error)}`, error, expected)
          return
        }
        fail("expected the promise to reject", actual, expected)
      },
      async toBe(expected) {
        try {
          await (actual as Promise<unknown>)
        } catch (error) {
          if (!Object.is(error, expected)) fail(`expected the rejection to be ${show(expected)}, got ${show(error)}`, error, expected)
          return
        }
        fail("expected the promise to reject", actual, expected)
      },
    },
  }
}

expect.any = (type: unknown) =>
  asymmetric(`Any<${(type as { name?: string }).name}>`, (value) =>
    type === String ? typeof value === "string" : type === Number ? typeof value === "number" : type === Boolean ? typeof value === "boolean" : type === Function ? typeof value === "function" : type === Object ? isObject(value) : value instanceof (type as new () => unknown),
  )
expect.stringMatching = (pattern: RegExp | string) => asymmetric(`StringMatching ${String(pattern)}`, (value) => typeof value === "string" && (typeof pattern === "string" ? value.includes(pattern) : pattern.test(value)))
expect.stringContaining = (text: string) => asymmetric(`StringContaining ${JSON.stringify(text)}`, (value) => typeof value === "string" && value.includes(text))
expect.objectContaining = (shape: Record<string, unknown>) => asymmetric(`ObjectContaining ${show(shape)}`, (value) => equals(value, shape, true))
