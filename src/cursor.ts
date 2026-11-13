/**
 * The cursor codec: opaque, versioned, and bound to `(plugin, source, account, scope)` (design §2.1, "Cursor").
 *
 * Two codecs, both base64url JSON of at most 1024 characters:
 *
 * - **Version 1** (contract 1, the family's nine plugins today): `encodeCursor(source, state)` and
 *   `decodeCursor(source, cursor)`, byte for byte as `src/host/events-list.ts` has them. The library binds only the
 *   source; each plugin binds the account and its signed-in owner inside its own state (six of the nine put the
 *   account in `a` and all nine an owner hash in `o`).
 * - **Version 2** (the final design): `encodeBoundCursor(binding, state)` and `decodeBoundCursor(binding, cursor)`.
 *   The library binds the whole `(plugin, source, account, scope)`: the cursor carries a 16-hex-digit hash of the
 *   canonical binding, so a cursor from another plugin, source, account or scope is refused as `foreign`, never
 *   restarted. The plugin still adds what only it knows, such as its owner hash.
 *
 * A source that adopts version 2 may keep accepting the version 1 cursors its collectors already hold, during the
 * migration, with `decodeBoundCursor(binding, cursor, { acceptV1: true })`: a version 1 cursor of the same source
 * decodes, with `legacy: true`, and the source checks its own account binding as it does today.
 *
 * Dependency-free: `node:crypto` and `Buffer` only. Runs on Node and Bun.
 */
import { createHash } from "node:crypto"

/** The most characters a cursor takes. */
export const MAX_CURSOR_LENGTH = 1024

/** Contract 1's cursor version. */
export const CURSOR_V1 = 1
/** The bound cursor's version. */
export const CURSOR_V2 = 2

/** The keys the codecs keep for themselves: a plugin's state never uses them. */
export const RESERVED_STATE_KEYS: readonly string[] = ["v", "s", "b"]

const plainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const BASE64URL = /^[A-Za-z0-9_-]+$/

function parse(cursor: string): Record<string, unknown> | undefined {
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH || !BASE64URL.test(cursor)) return undefined
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    return plainObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function pack(payload: Record<string, unknown>, what: string): string {
  const cursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  if (cursor.length > MAX_CURSOR_LENGTH) throw new Error(`cursor: a ${what} cursor is ${cursor.length} characters, over ${MAX_CURSOR_LENGTH}`)
  return cursor
}

// ── Version 1: contract 1, unchanged ──────────────────────────────────────

/**
 * An opaque cursor for `source` holding `state`: base64url JSON that names the source, so another source's cursor is
 * refused. Throws when it would be longer than 1024 characters, a bug in the source.
 */
export function encodeCursor(source: string, state: Readonly<Record<string, unknown>>): string {
  // Contract 1's exact output: the state's keys, then v and s (a state key named v or s is overwritten, as before).
  const cursor = Buffer.from(JSON.stringify({ ...state, v: CURSOR_V1, s: source }), "utf8").toString("base64url")
  if (cursor.length > MAX_CURSOR_LENGTH) throw new Error(`events-list: a ${source} cursor is ${cursor.length} characters, over ${MAX_CURSOR_LENGTH}`)
  return cursor
}

/** The state `encodeCursor` stored for `source`; undefined when the cursor is malformed or another source's. */
export function decodeCursor(source: string, cursor: string): Record<string, unknown> | undefined {
  const parsed = parse(cursor)
  if (!parsed || parsed["v"] !== CURSOR_V1 || parsed["s"] !== source) return undefined
  const { v: _v, s: _s, ...state } = parsed
  return state
}

// ── Version 2: bound to (plugin, source, account, scope) ──────────────────

/** A scope as a source receives it: each key a value or a list of values (labels, channels, repositories). */
export type Scope = Readonly<Record<string, string | readonly string[]>>

/** What a cursor is bound to. `scope` absent or `{}` is the whole source. */
export interface CursorBinding {
  /** The plugin's package name or id, as the descriptor names it. */
  readonly plugin: string
  /** The source's name within the plugin (`gmail`), as `events_list`'s `source` input names it. */
  readonly source: string
  /** The account the source read, `default` included. */
  readonly account: string
  readonly scope?: Scope
}

/**
 * A scope in one canonical form: keys sorted, each list's values sorted and without repeats, a one-value list kept as
 * a list (so `{label: "A"}` and `{label: ["A"]}` differ, as the source may read them differently). Empty lists and
 * an empty scope stay. Throws on a value that is not a string or a list of strings.
 */
export function canonicalScope(scope: Scope | undefined): Record<string, string | string[]> {
  if (scope === undefined) return {}
  if (!plainObject(scope)) throw new Error("cursor: a scope must be an object")
  const out: Record<string, string | string[]> = {}
  for (const key of Object.keys(scope).sort()) {
    const value = scope[key]
    if (typeof value === "string") out[key] = value
    else if (Array.isArray(value) && value.every((item) => typeof item === "string")) out[key] = [...new Set(value as string[])].sort()
    else throw new Error(`cursor: the scope key "${key}" must be a string or a list of strings`)
  }
  return out
}

/** The binding's hash: the first 16 hex digits of SHA-256 over its canonical JSON. */
export function bindingHash(binding: CursorBinding): string {
  const canonical = JSON.stringify([binding.plugin, binding.source, binding.account, canonicalScope(binding.scope)])
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16)
}

/**
 * A version 2 cursor for `binding` holding `state`. Throws when the state uses a reserved key (`v`, `s`, `b`) or the
 * cursor would be longer than 1024 characters: both are bugs in the source.
 */
export function encodeBoundCursor(binding: CursorBinding, state: Readonly<Record<string, unknown>>): string {
  const reserved = Object.keys(state).find((key) => RESERVED_STATE_KEYS.includes(key))
  if (reserved !== undefined) throw new Error(`cursor: the state key "${reserved}" is reserved`)
  return pack({ v: CURSOR_V2, s: binding.source, b: bindingHash(binding), ...state }, `${binding.plugin}/${binding.source}`)
}

/** Why a cursor did not decode. `malformed`: not a cursor at all. `foreign`: another binding's, or another version's. */
export type CursorRefusal = "malformed" | "foreign"

export type DecodedCursor =
  | { readonly ok: true; readonly state: Record<string, unknown>; readonly legacy: boolean }
  | { readonly ok: false; readonly reason: CursorRefusal }

/**
 * The state `encodeBoundCursor` stored for `binding`. A cursor of another plugin, source, account or scope is
 * `foreign`; one that is not base64url JSON of an object is `malformed`. With `acceptV1`, a contract 1 cursor of the
 * same source decodes with `legacy: true`, and its account binding is the source's own to check. Either refusal is
 * `CURSOR_INVALID` to the caller.
 */
export function decodeBoundCursor(binding: CursorBinding, cursor: string, options: { readonly acceptV1?: boolean } = {}): DecodedCursor {
  const parsed = parse(cursor)
  if (!parsed) return { ok: false, reason: "malformed" }
  if (parsed["v"] === CURSOR_V1 && options.acceptV1 === true) {
    const state = decodeCursor(binding.source, cursor)
    return state ? { ok: true, state, legacy: true } : { ok: false, reason: "foreign" }
  }
  if (parsed["v"] !== CURSOR_V2 || parsed["s"] !== binding.source || parsed["b"] !== bindingHash(binding)) return { ok: false, reason: "foreign" }
  const { v: _v, s: _s, b: _b, ...state } = parsed
  return { ok: true, state, legacy: false }
}
