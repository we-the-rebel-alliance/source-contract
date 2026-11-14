/**
 * A page the `events` module accepts, from a test's partial one: every event gains the envelope's source and account,
 * the fields the authority requires and its `eventHash`; a refusal gains a reason and a failure a code. Tests build the
 * page they are about; this makes the rest conformant.
 */
import { eventHash } from "../../src/events.ts"

export function validPage(page: Record<string, unknown>): Record<string, unknown> {
  // A source item shares the builder's signature in the tests; it is not a page, and is returned untouched.
  if (page["events"] === undefined && page["cursor"] === undefined) return page
  const source = typeof page["source"] === "string" ? page["source"] : "slack"
  const account = typeof page["account"] === "string" ? page["account"] : "T0PILOT01"
  const events = ((page["events"] as Record<string, unknown>[] | undefined) ?? []).map((event) => {
    const { hash, ...rest } = event
    const full = {
      source,
      account,
      external_id: "C0PILOT001:1",
      kind: "message",
      occurred_at: "2026-11-01T12:30:00.000Z",
      thread: null,
      actors: [],
      title: "a message",
      text: "",
      url: null,
      labels: [],
      ...rest,
    }
    return { ...full, hash: eventHash(full as never) }
  })
  events.sort((a, b) => Date.parse(String(a["occurred_at"])) - Date.parse(String(b["occurred_at"])))
  const map = (list: unknown, field: string, value: string): unknown =>
    Array.isArray(list) ? list.map((entry) => ({ ...(entry as Record<string, unknown>), ...(field in (entry as Record<string, unknown>) ? {} : { [field]: value }) })) : list
  return {
    ...page,
    account,
    owner: page["owner"] === null || page["owner"] === undefined ? { id: `${source}:owner`, label: "Conformance Owner" } : page["owner"],
    trust: "untrusted",
    asOf: "2026-11-13T09:00:00.000Z",
    plugin: page["plugin"] ?? "@joe-broadhead/opencode-slack",
    ...(page["events"] === undefined ? {} : { events }),
    ...(page["refused"] === undefined ? {} : { refused: map(page["refused"], "reason", "instruction") }),
    ...(page["failed"] === undefined ? {} : { failed: map(page["failed"], "code", "RATE_LIMITED") }),
  }
}
