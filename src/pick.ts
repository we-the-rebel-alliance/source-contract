/**
 * `pick`: the paths a read keeps (design §2.3). Every read can carry it; only those paths are returned, and a key the
 * answer does not have is left out, not an error, because providers leave optional keys out (a Calendar event often
 * has no `location`).
 *
 * Ported from Artifacts' field picker (`pickFields` and `missingFields`, ADR 0044, in we-the-rebel-alliance/artifacts),
 * with its path grammar and limits, and one addition: `pickProblems` checks the paths against the source's output
 * schema when the binding is made, so a typo fails at consent rather than reading nothing.
 *
 * A path is dotted segments; a segment ending in `[]` maps over an array: `items[].title`, `items[].attendees[].email`.
 */
import { outputValidator } from "./registry.ts"

/** At most this many paths in one pick (Artifacts' defaults). */
export const MAX_PICK_PATHS = 50
/** Each path is at most this many characters. */
export const MAX_PICK_PATH_LENGTH = 200

const SEGMENT = "[A-Za-z0-9_$-]+(?:\\[\\])?"
/** A pick path: segments of letters, digits, `_`, `$` and `-`, each optionally ending in `[]`. */
export const PICK_PATH = new RegExp(`^${SEGMENT}(?:\\.${SEGMENT})*$`)

/** A JSON value's shape, as JSON Schema says it. */
export type JsonSchema = Readonly<Record<string, unknown>> | boolean

/** One segment of a path: its property name, and whether `[]` maps over an array. */
type Segment = { readonly name: string; readonly maps: boolean }

/** A value the path did not reach. A symbol, so no JSON value can be mistaken for it. */
const MISSING = Symbol("missing")

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

function segments(path: string): Segment[] {
  return path.split(".").map((part) => {
    const maps = part.endsWith("[]")
    return { name: maps ? part.slice(0, -2) : part, maps }
  })
}

/**
 * The part of `value` this path keeps, in its own nesting, or `MISSING` when the path reaches nothing: a key that is
 * not there, or a value of the wrong type on the way. Over an array, an item the path cannot enter keeps its place as
 * `{}`, so the paths over one array still line up.
 */
function project(value: unknown, path: readonly Segment[]): unknown {
  const [segment, ...rest] = path
  if (segment === undefined) return value
  if (!plain(value) || !Object.hasOwn(value, segment.name)) return MISSING
  const child = value[segment.name]
  if (!segment.maps) {
    const projected = project(child, rest)
    return projected === MISSING ? MISSING : { [segment.name]: projected }
  }
  if (!Array.isArray(child)) return MISSING
  return {
    [segment.name]: child.map((item) => {
      const projected = project(item, rest)
      return projected === MISSING ? {} : projected
    }),
  }
}

/** Whether this path reaches a value anywhere in `value`. A path over an empty array counts as reached. */
function reaches(value: unknown, path: readonly Segment[]): boolean {
  const [segment, ...rest] = path
  if (segment === undefined) return true
  if (!plain(value) || !Object.hasOwn(value, segment.name)) return false
  const child = value[segment.name]
  if (!segment.maps) return reaches(child, rest)
  if (!Array.isArray(child)) return false
  return child.length === 0 || child.some((item) => reaches(item, rest))
}

/** Two projected paths merged, or `MISSING` when their arrays do not line up. */
function merge(left: unknown, right: unknown): unknown {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return MISSING
    const merged: unknown[] = []
    for (let index = 0; index < left.length; index += 1) {
      const item = merge(left[index], right[index])
      if (item === MISSING) return MISSING
      merged.push(item)
    }
    return merged
  }
  if (plain(left) && plain(right)) {
    const merged: Record<string, unknown> = { ...left }
    for (const [key, value] of Object.entries(right)) {
      const item = Object.hasOwn(merged, key) ? merge(merged[key], value) : value
      if (item === MISSING) return MISSING
      // A path may name any key, `__proto__` included; define it as data.
      Object.defineProperty(merged, key, { value: item, enumerable: true, configurable: true, writable: true })
    }
    return merged
  }
  // Where one path ends and another goes deeper, the deeper one wins; an item one path could not enter (`{}`) gives way
  // to what another path kept.
  if (plain(right) && Object.keys(right).length === 0) return left
  return right
}

/**
 * Only the picked paths of `data`, in its own nesting. A path the data does not have, in an item or in the whole, is
 * left out. Only data that is not a JSON object fails.
 */
export function pick(data: unknown, paths: readonly string[]): { readonly ok: true; readonly data: Record<string, unknown> } | { readonly ok: false } {
  if (!plain(data)) return { ok: false }
  let picked: Record<string, unknown> = {}
  for (const path of paths) {
    const projected = project(data, segments(path))
    if (projected === MISSING) continue
    const merged = merge(picked, projected)
    // Two paths over one array always line up; a merge that cannot is skipped.
    if (merged === MISSING || !plain(merged)) continue
    picked = merged
  }
  return { ok: true, data: picked }
}

/** The paths that reach nothing anywhere in `data`, in the order given: a diagnostic, never a failure of the read. */
export function missingPaths(data: unknown, paths: readonly string[]): string[] {
  return paths.filter((path) => !reaches(data, segments(path)))
}

// ── Paths against a schema ──────────────────────────────────────────────

const MAX_REF_DEPTH = 32

/** Every schema `schema` may be, through `$ref`, `anyOf`, `oneOf` and `allOf`. */
function branches(schema: JsonSchema, root: JsonSchema, depth = 0): JsonSchema[] {
  if (typeof schema === "boolean" || depth > MAX_REF_DEPTH) return [schema]
  const ref = schema["$ref"]
  if (typeof ref === "string") {
    const target = resolveRef(ref, root)
    return target === undefined ? [true] : branches(target, root, depth + 1)
  }
  const options = [schema["anyOf"], schema["oneOf"], schema["allOf"]].filter(Array.isArray).flat() as JsonSchema[]
  if (options.length === 0) return [schema]
  return options.flatMap((option) => branches(option, root, depth + 1))
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  if (!ref.startsWith("#/") || typeof root === "boolean") return undefined
  let node: unknown = root
  for (const part of ref.slice(2).split("/").map((piece) => piece.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!plain(node) || !Object.hasOwn(node, part)) return undefined
    node = node[part]
  }
  return plain(node) || typeof node === "boolean" ? (node as JsonSchema) : undefined
}

const types = (schema: Readonly<Record<string, unknown>>): string[] | undefined => {
  const type = schema["type"]
  return typeof type === "string" ? [type] : Array.isArray(type) ? type.filter((item): item is string => typeof item === "string") : undefined
}

/** The schema of `name` in an object schema, or undefined when no object it may be has that key. */
function property(schema: JsonSchema, name: string, root: JsonSchema): JsonSchema[] {
  return branches(schema, root).flatMap((branch) => {
    if (branch === true) return [true]
    if (branch === false) return []
    const kinds = types(branch)
    if (kinds && !kinds.includes("object")) return []
    const properties = branch["properties"]
    if (plain(properties) && Object.hasOwn(properties, name)) return [properties[name] as JsonSchema]
    const additional = branch["additionalProperties"]
    if (additional === false) return []
    if (plain(additional)) return [additional as JsonSchema]
    // JSON Schema's default: an object that does not close its keys (a record, or any object) may have this one.
    return [true]
  })
}

/** The item schemas of an array schema, or none when nothing it may be is an array. */
function items(schema: JsonSchema, root: JsonSchema): JsonSchema[] {
  return branches(schema, root).flatMap((branch) => {
    if (branch === true) return [true]
    if (branch === false) return []
    const kinds = types(branch)
    if (kinds && !kinds.includes("array")) return []
    const item = branch["items"]
    return [plain(item) || typeof item === "boolean" ? (item as JsonSchema) : true]
  })
}

function schemaReaches(schema: JsonSchema, path: readonly Segment[], root: JsonSchema): boolean {
  const [segment, ...rest] = path
  if (segment === undefined) return true
  for (const child of property(schema, segment.name, root)) {
    const next = segment.maps ? items(child, root) : [child]
    if (next.some((item) => schemaReaches(item, rest, root))) return true
  }
  return false
}

/**
 * Every problem with a pick, one sentence each: not a list, too many paths, a path that breaks the grammar or is too
 * long, a repeated path, and, given the output's JSON Schema, a path no value of that schema can have. None when the
 * pick is good.
 */
export function pickProblems(paths: unknown, schema?: JsonSchema): string[] {
  if (!Array.isArray(paths)) return ["pick must be a list of paths"]
  const problems: string[] = []
  if (paths.length === 0) problems.push("pick must name at least one path")
  if (paths.length > MAX_PICK_PATHS) problems.push(`pick names ${paths.length} paths, over ${MAX_PICK_PATHS}`)
  const seen = new Set<string>()
  for (const [index, path] of paths.entries()) {
    if (typeof path !== "string" || path.length === 0) {
      problems.push(`pick[${index}] must be a path such as items[].title`)
      continue
    }
    if (path.length > MAX_PICK_PATH_LENGTH) {
      problems.push(`pick[${index}] is ${path.length} characters, over ${MAX_PICK_PATH_LENGTH}`)
      continue
    }
    if (!PICK_PATH.test(path)) {
      problems.push(`pick[${index}] "${path}" must be dotted names of letters, digits, _, $ or -, each optionally ending in [] to map over a list`)
      continue
    }
    if (seen.has(path)) problems.push(`pick[${index}] "${path}" repeats a path`)
    seen.add(path)
    if (schema !== undefined && !schemaReaches(schema, segments(path), schema)) problems.push(`pick[${index}] "${path}" is not a path of the output`)
  }
  return problems
}

/** `pickProblems` against a registered output by name; a name the registry does not hold is a problem. */
export function pickProblemsForOutput(output: string, paths: unknown): string[] {
  const found = outputValidator(output)
  if (!found) return [`"${output}" is not a registered output`]
  return pickProblems(paths, found.jsonSchema())
}
