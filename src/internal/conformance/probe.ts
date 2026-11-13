/**
 * `probe` (§2.3): the owner and the granted scopes, per source, so a Calendar-only sign-in works. It reads no content,
 * and it asserts only its own grant.
 */
import type { SourceItem } from "../schema/types.ts"

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The keys that would mean a probe returned content. */
const CONTENT_KEYS = ["events", "data", "body", "content", "items", "text", "title"]

/** Every problem with a probe answer, one sentence each. */
export function probeProblems(answer: unknown, source: SourceItem): string[] {
  const where = `probe(${source.id})`
  if (!plain(answer)) return [`${where} answered nothing: an object with account and owner`]
  const problems: string[] = []
  if (typeof answer["account"] !== "string" || answer["account"].length === 0) problems.push(`${where} must answer the account`)
  const owner = answer["owner"]
  if (owner !== null && owner !== undefined) {
    if (!plain(owner) || typeof owner["id"] !== "string" || owner["id"].length === 0) problems.push(`${where} owner must be null or { id, label? }`)
    else if (owner["label"] !== undefined && typeof owner["label"] !== "string") problems.push(`${where} owner.label must be a string when present`)
  } else if (owner === undefined) {
    problems.push(`${where} must answer owner as null or { id, label? }`)
  }
  for (const key of CONTENT_KEYS) {
    if (answer[key] !== undefined) problems.push(`${where} must read no content, and it answered "${key}"`)
  }
  const scopes = answer["scopes"]
  if (scopes !== undefined && (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === "string"))) {
    problems.push(`${where} scopes must be a list of strings when present`)
  }
  return problems
}
