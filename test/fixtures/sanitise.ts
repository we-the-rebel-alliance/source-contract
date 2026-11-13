/**
 * What a fixture may not hold: a secret pattern (Memory's detector), a local path, an email outside example.com,
 * example.org and example.test, or a URL host outside the synthetic hosts the nine plugins' fakes use. The builder
 * refuses to write such a fixture, and the runner checks every fixture again.
 */
import { secretKinds } from "../../src/events.ts"

export const ALLOWED_HOSTS = ["github.com", "linear.app", "x.com", "acme.slack.com", "notes.example.test", "mail.google.com", "notes.wisprflow.ai"]
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
const LOCAL_PATH = /(?:^|[\s"'(=])(?:\/(?:Users|home|root|private|var|tmp|Volumes|mnt)\/|~\/|[A-Za-z]:\\)/

/** Every string in a value, depth first. */
function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value
  else if (Array.isArray(value)) for (const item of value) yield* strings(item)
  else if (value && typeof value === "object") for (const item of Object.values(value as object)) yield* strings(item)
}

export function sanitisationProblems(value: unknown): string[] {
  const problems = new Set<string>()
  for (const text of strings(value)) {
    const secrets = secretKinds(text)
    if (secrets.length > 0) problems.add(`a secret pattern (${secrets.join(", ")})`)
    if (LOCAL_PATH.test(text)) problems.add("a local path")
    for (const match of text.matchAll(EMAIL)) if (!/(^|\.)example\.(com|org|test)$/i.test(match[1]!)) problems.add(`an email at ${match[1]}`)
    for (const match of text.matchAll(/https?:\/\/([^/\s"'?#]+)/g)) if (!ALLOWED_HOSTS.includes(match[1]!.toLowerCase())) problems.add(`a URL host ${match[1]}`)
  }
  return [...problems]
}
