// The final design's additions to contract 1 (CHANGES.md): kinds, scope, the page result's refused, failed, gap, cost,
// plugin and asOf, the error table, the secret-pattern refusal, and the conformance's opt-in checks.
import { describe, test } from "node:test"
import { expect } from "./support/expect.ts"
import { encodeBoundCursor, decodeBoundCursor, type CursorBinding } from "../src/cursor.ts"
import {
  canonicalCode,
  EVENT_KINDS,
  eventProblems,
  eventsListConformance,
  eventsListResult,
  fitPage,
  EXTENSION_KIND,
  EXTENSION_NAME,
  EXTENSION_SEGMENT_MAX,
  extensionNamespace,
  isExtensionName,
  isEventKind,
  isEventKindIn,
  sourceNamespace,
  makeEvent,
  MAX_BYTES,
  MAX_PAGE_BYTES,
  parseEventsListInput,
  parseProbeInput,
  PROBE,
  probeResult,
  probeResultProblems,
  parseSourceError,
  resultProblems,
  screenEvents,
  secretKinds,
  SourceError,
  startTime,
  type ConformanceCall,
  type EventsListInput,
  type SourceEvent,
} from "../src/events.ts"

const T0 = Date.parse("2026-11-01T09:00:00Z")
const OWNER = { id: "mailto:sam@example.com", label: "sam@example.com" }
const WHOSE = { source: "demo", account: "work", owner: OWNER }
const event = (index: number, extra: Partial<Parameters<typeof makeEvent>[0]> = {}): SourceEvent =>
  makeEvent({ source: "demo", account: "work", external_id: `item-${index}`, kind: "message", occurred_at: T0 + index * 60_000, title: `Item ${index}`, text: `Text ${index}`, ...extra })

describe("kinds", () => {
  test("adds task and file to the nine, and takes x-<plugin>/<kind>", () => {
    expect(EVENT_KINDS.slice(9)).toEqual(["task", "file"])
    for (const kind of ["task", "file", "x-jelly/routine-run", "x-gws/label-change"]) {
      expect(isEventKind(kind), kind).toBe(true)
      expect(eventProblems(event(1, { kind: kind as never })), kind).toEqual([])
    }
    for (const kind of ["tweet", "x-/a", "x-jelly", "x-Jelly/run", "x-jelly/Run", `x-jelly/${"a".repeat(60)}`]) expect(isEventKind(kind), kind).toBe(false)
  })

  test("one length rule for kinds and outputs: each segment 1 to 32 characters (source-contract#21)", () => {
    const max = "a".repeat(EXTENSION_SEGMENT_MAX)
    expect(EXTENSION_SEGMENT_MAX).toBe(32)
    expect(isEventKind(`x-${max}/${max}`)).toBe(true)
    expect(isExtensionName(`x-${max}/${max}`)).toBe(true)
    expect(isEventKind(`x-${max}a/run`)).toBe(false)
    expect(isEventKind(`x-jelly/${max}a`)).toBe(false)
    expect(isExtensionName("x-mem/receipt")).toBe(true)
    expect(isExtensionName("message")).toBe(false)
    expect(EXTENSION_KIND).toBe(EXTENSION_NAME)
  })
})

describe("extension kinds and their namespace (D13, source-contract#15)", () => {
  test("x-jelly/routine-run is a kind, in jelly's namespace and no other", () => {
    expect(isEventKind("x-jelly/routine-run")).toBe(true)
    expect(extensionNamespace("x-jelly/routine-run")).toBe("jelly")
    expect(extensionNamespace("meeting")).toBeUndefined()
    expect(extensionNamespace("x-jelly")).toBeUndefined()
    expect(sourceNamespace("jelly.routine-runs")).toBe("jelly")
    expect(sourceNamespace("gws.gmail")).toBe("gws")
    expect(isEventKindIn("x-jelly/routine-run", sourceNamespace("jelly.routine-runs"))).toBe(true)
    expect(isEventKindIn("meeting", "jelly")).toBe(true)
    expect(isEventKindIn("x-mem/suggestion", "jelly")).toBe(false)
    expect(isEventKindIn("x-jelly/Run", "jelly")).toBe(false)
  })

  test("the conformance refuses an x- kind outside the source's namespace, when told the namespace", async () => {
    const items = [event(0, { kind: "x-jelly/routine-run" }), event(1)]
    const list = async (input: EventsListInput) => {
      const parsed = parseEventsListInput(input)
      if (!parsed.ok) throw new SourceError({ code: "INPUT_INVALID", what: parsed.problems.join("; "), next: "Fix it." })
      if (parsed.value.source !== undefined && parsed.value.source !== "demo") throw new SourceError({ code: "SOURCE_UNKNOWN", what: "no", next: "Pass demo." })
      if (parsed.value.cursor !== undefined) {
        const decoded = decodeBoundCursor({ plugin: "jelly", source: "demo", account: "work" }, parsed.value.cursor)
        if (!decoded.ok) throw new SourceError({ code: "CURSOR_INVALID", what: "no", next: "Start again." })
        const n = decoded.state["n"] as number
        const page = items.slice(n, n + parsed.value.limit)
        return eventsListResult(WHOSE, page, encodeBoundCursor({ plugin: "jelly", source: "demo", account: "work" }, { n: n + page.length }), n + page.length < items.length)
      }
      const from = parsed.value.since !== undefined && parsed.value.since > T0 + 3_600_000 ? items.length : 0
      const page = items.slice(from, from + parsed.value.limit)
      return eventsListResult(WHOSE, page, encodeBoundCursor({ plugin: "jelly", source: "demo", account: "work" }, { n: from + page.length }), from + page.length < items.length)
    }
    const fixtures = { source: "demo", account: "work", since: "2026-11-01T08:00:00Z", expected: ["item-0", "item-1"] }
    expect(await eventsListConformance(list, { ...fixtures, namespace: "jelly" })).toEqual([])
    expect(await eventsListConformance(list, fixtures)).toEqual([])
    expect(await eventsListConformance(list, { ...fixtures, namespace: "mem" })).toContainEqual(expect.stringContaining("is a x-jelly/routine-run, outside the namespace mem"))
  })
})

describe("probe (source-contract#8, #4)", () => {
  test("is one method, probe, taking only source and account", () => {
    expect(PROBE).toBe("probe")
    expect(parseProbeInput({})).toEqual({ ok: true, value: {} })
    expect(parseProbeInput(undefined)).toEqual({ ok: true, value: {} })
    expect(parseProbeInput({ source: "gmail", account: "work" })).toEqual({ ok: true, value: { source: "gmail", account: "work" } })
    expect(parseProbeInput({ source: "gmail", limit: 0 })).toEqual({ ok: false, problems: ['"limit" is not an input of probe'] })
    expect((parseProbeInput({ source: "Gmail", account: "" }) as { problems: string[] }).problems).toHaveLength(2)
  })

  test("answers source, account, owner { id, label }, the sign-in's scopes and X's probe cost, untrusted", () => {
    const answer = probeResult(WHOSE, { scopes: ["gmail.readonly", "gmail.readonly"], cost: { units: [{ per: "call", count: 1 }], usd: 0.01 } })
    expect(answer).toEqual({ source: "demo", account: "work", owner: OWNER, scopes: ["gmail.readonly"], cost: { units: [{ per: "call", count: 1 }], usd: 0.01 }, trust: "untrusted" })
    expect(probeResultProblems(answer, { source: "demo", account: "work" })).toEqual([])
    expect(probeResultProblems(probeResult(WHOSE))).toEqual([])
  })

  test("finds a probe that read content, has no owner label, or answers for another source or account", () => {
    const answer = probeResult(WHOSE)
    expect(probeResultProblems({ ...answer, events: [] })).toEqual([expect.stringContaining('the field "events": a probe reads no content')])
    expect(probeResultProblems({ ...answer, owner: { id: OWNER.id } })).toEqual(["the probe answer's owner must be { id, label }, two non-empty lines"])
    expect(probeResultProblems({ ...answer, owner: null })).toHaveLength(1)
    expect(probeResultProblems(answer, { source: "gmail" })).toEqual(["the probe answer names the source demo, not gmail"])
    expect(probeResultProblems(answer, { account: "home" })).toEqual(["the probe answer names another account than the one asked for"])
    expect(probeResultProblems({ ...answer, trust: "trusted" })).toEqual([expect.stringContaining("trust")])
    expect(probeResultProblems({ ...answer, scopes: ["a", "a"] })).toEqual([expect.stringContaining("scopes")])
    expect(probeResultProblems({ ...answer, cost: { units: [{ per: "call", count: -1 }] } })).toEqual([expect.stringContaining("the probe answer's cost")])
  })
})

describe("scope input", () => {
  test("is refused, as contract 1 refuses it, unless the source declares scope keys", () => {
    expect(parseEventsListInput({ scope: { label: "INBOX" } })).toEqual({ ok: false, problems: ['"scope" is not an input of events_list'] })
  })

  test("with declared keys, is checked and made canonical, naming keys and never values", () => {
    const parse = (scope: unknown) => parseEventsListInput({ scope }, { scopeKeys: ["label", "channels"] })
    expect(parse({ label: ["b", "a", "a"] })).toEqual({ ok: true, value: { limit: 100, scope: { label: ["a", "b"] } } })
    expect(parse({ repo: "x" })).toEqual({ ok: false, problems: ['"scope.repo" is not a scope key of this source'] })
    expect((parse({ label: ["ok", ""] }) as { problems: string[] }).problems).toEqual([expect.stringContaining('"scope.label" must be')])
    expect((parse({ label: "x\ny" }) as { problems: string[] }).problems).toHaveLength(1)
    expect((parse("INBOX") as { problems: string[] }).problems).toEqual(['"scope" must be an object of the source\'s scope keys'])
    expect(JSON.stringify(parse({ label: "secret-label\u0000" }))).not.toContain("secret-label")
  })
})

describe("the default page cap (D10)", () => {
  test("is the descriptor's default maxBytes, 64 KB", () => {
    expect(MAX_PAGE_BYTES).toBe(MAX_BYTES.default)
    expect(MAX_PAGE_BYTES).toBe(65_536)
  })
})

describe("the page result", () => {
  const ok = (extras: Parameters<typeof eventsListResult>[4]) => resultProblems(eventsListResult(WHOSE, [event(1), event(2)], "c", false, extras))

  test("a contract 1 page is a valid page, and the builder writes nothing new without extras", () => {
    const page = eventsListResult(WHOSE, [event(1)], "c", false)
    expect(Object.keys(page)).toEqual(["source", "account", "owner", "events", "cursor", "more", "trust"])
    expect(resultProblems(page)).toEqual([])
  })

  test("takes refused, failed, gap, cost, scope, plugin and asOf, and leaves out empty lists", () => {
    const page = eventsListResult(WHOSE, [event(1)], "c", true, {
      scope: { label: ["b", "a"] },
      refused: [{ external_id: "item-9", reason: "secret", detail: "holds a secret (token)" }],
      failed: [{ external_id: "item-8", code: "RATE_LIMITED", retryAfterSec: 30 }],
      gap: { reason: "expired", since: "2026-10-01T00:00:00.000Z" },
      cost: { units: [{ per: "post", count: 1 }, { per: "author", count: 1 }], usd: 0.015 },
      plugin: "opencode-x",
      asOf: "2026-11-01T09:05:00.000Z",
    })
    expect(page.scope).toEqual({ label: ["a", "b"] })
    expect(resultProblems(page)).toEqual([])
    expect(Object.hasOwn(eventsListResult(WHOSE, [], "c", false, { refused: [], failed: [] }), "refused")).toBe(false)
  })

  test("finds each way an addition breaks the contract", () => {
    expect(ok({ refused: [{ external_id: "item-1", reason: "secret" }] })).toEqual(["refused[0] is also among the result's events"])
    expect(ok({ refused: [{ external_id: "x", reason: "spam" as never }] })).toEqual([expect.stringContaining("refused[0].reason must be one of instruction, secret, owner")])
    expect(ok({ refused: [{ external_id: "x", reason: "secret", detail: "a\nb" }] })).toEqual([expect.stringContaining("detail")])
    expect(ok({ refused: [{ external_id: "x", reason: "secret" }, { external_id: "x", reason: "owner" }] })).toEqual(["the result's refused lists one event twice"])
    expect(ok({ failed: [{ external_id: "x", code: "rate limited" }] })).toEqual([expect.stringContaining("failed[0].code")])
    expect(ok({ failed: [{ external_id: "x", code: "RATE_LIMITED", retryAfterSec: 1.5 }] })).toEqual([expect.stringContaining("retryAfterSec")])
    expect(ok({ refused: [{ external_id: "x", reason: "owner" }], failed: [{ external_id: "x", code: "UNAVAILABLE" }] })).toEqual(["an event is both refused and failed"])
    expect(ok({ gap: { reason: "sync-token-expired" as never, since: "2026-10-01T00:00:00Z" } })).toEqual([expect.stringContaining("gap")])
    expect(ok({ gap: { reason: "expired", since: "2026-10-01" } })).toEqual([expect.stringContaining("gap")])
    expect(ok({ gap: { reason: "expired", since: "2026-10-01T00:00:00Z", until: "2026-10-02T00:00:00Z" } as never })).toEqual([expect.stringContaining("gap")])
    expect(ok({ cost: { units: [{ per: "post", count: -1 }] } })).toEqual([expect.stringContaining("cost")])
    expect(ok({ cost: { units: [], usd: -0.01 } })).toEqual([expect.stringContaining("cost")])
    expect(ok({ asOf: "now" })).toEqual([expect.stringContaining("asOf")])
    expect(resultProblems({ ...eventsListResult(WHOSE, [], "c", false), scope: { b: "1", a: "2" } })).toEqual([expect.stringContaining("canonical")])
  })

  test("a page within the descriptor's maxBytes, which fitPage takes", () => {
    const big = Array.from({ length: 40 }, (_, index) => event(index, { text: "y".repeat(4_000) }))
    const fits = fitPage(big, 500, 65_536)
    expect(fits).toBeGreaterThan(5)
    expect(fits).toBeLessThan(40)
    expect(resultProblems(eventsListResult(WHOSE, big.slice(0, fits), "c", true), 500, 65_536)).toEqual([])
    expect(resultProblems(eventsListResult(WHOSE, big, "c", true), 500, 65_536)).toEqual([expect.stringContaining("over 65536")])
  })
})

describe("errors", () => {
  test("reads the family's form, maps the alias and contract 1's codes, and carries retryAfterSec and gap", () => {
    const expired = new SourceError({ code: "CURSOR_EXPIRED", what: "Gmail no longer keeps history 1010.", next: "Call events_list with since.", gap: { reason: "expired", since: "2026-10-01T00:00:00.000Z" } })
    expect(expired.message).toBe("CURSOR_EXPIRED: Gmail no longer keeps history 1010. Next step: Call events_list with since.")
    expect(expired.gap).toEqual({ reason: "expired", since: "2026-10-01T00:00:00.000Z" })
    expect(parseSourceError(expired)).toEqual({ code: "CURSOR_EXPIRED", canonical: "CURSOR_EXPIRED", what: "Gmail no longer keeps history 1010.", next: "Call events_list with since." })
    expect(parseSourceError(new Error("AUTH_REQUIRED: the sign-in expired. Next step: Run /connect."))).toEqual({ code: "AUTH_REQUIRED", canonical: "NEEDS_SIGN_IN", what: "the sign-in expired", next: "Run /connect." })
    expect(parseSourceError(new Error("EVENTS_CURSOR_INVALID: no. Next step: x."))?.canonical).toBe("CURSOR_INVALID")
    expect(parseSourceError(new Error("GWS_VALIDATION_ERROR: Limit: Too big. Next step: x."))).toEqual({ code: "GWS_VALIDATION_ERROR", what: "Limit: Too big", next: "x." })
    expect(parseSourceError(new Error("The cursor is invalid or has expired."))).toBeUndefined()
    for (const code of ["SCOPE_MISSING", "BUDGET_EXCEEDED", "SOURCE_DISABLED", "INPUT_INVALID", "SOURCE_UNKNOWN"]) expect(canonicalCode(code)).toBe(code)
    expect(new SourceError({ code: "RATE_LIMITED", what: "x", next: "Wait.", retryAfterSec: 60 }).retryAfterSec).toBe(60)
  })
})

describe("the secret-pattern refusal", () => {
  test("is Memory's detector: tokens, keys, private keys and credential assignments, not prose or placeholders", () => {
    expect(secretKinds("ghp_abcdefghijklmnop1234")).toEqual(["token"])
    expect(secretKinds("AKIAABCDEFGHIJKLMNOP")).toEqual(["api key"])
    expect(secretKinds("-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----")).toEqual(["private key"])
    expect(secretKinds("password = hunter2!x")).toEqual(["password"])
    expect(secretKinds("postgres://app:s3cr3t@db.internal/app")).toEqual(["connection string"])
    for (const clean of ["password: rotated quarterly", "token: 4096", "api_key=<your-key-here>", "Let's review the plan on Monday", "sk-example"]) expect(secretKinds(clean), clean).toEqual([])
  })

  test("screenEvents refuses an event that is not the owner's, holds a secret, or is instruction-shaped, never echoing it", () => {
    const events = [event(1), event(2, { text: "the key is ghp_abcdefghijklmnop1234" }), event(3), event(4)]
    const screened = screenEvents(events, { ownedBy: (e) => e.external_id !== "item-3", instruction: (e) => e.external_id === "item-4" })
    expect(screened.events.map((e) => e.external_id)).toEqual(["item-1"])
    expect(screened.refused).toEqual([
      { external_id: "item-2", reason: "secret", detail: "holds a secret (token)" },
      { external_id: "item-3", reason: "owner" },
      { external_id: "item-4", reason: "instruction" },
    ])
    expect(JSON.stringify(screened.refused)).not.toContain("ghp_")
  })
})

/** A reference source that implements the final design: bound cursor, scope, refused, the table's codes. */
function finalSource(items: readonly SourceEvent[], options: { readonly codes?: boolean; readonly echo?: boolean; readonly unbound?: boolean; readonly leakSecret?: boolean } = {}) {
  const plugin = "opencode-demo"
  const refuse = (code: string, what: string) => {
    throw options.codes === false ? new Error(what) : new SourceError({ code, what, next: "Call events_list with the inputs its schema names." })
  }
  return async (input: EventsListInput) => {
    const parsed = parseEventsListInput(input, { scopeKeys: ["label"] })
    if (!parsed.ok) return refuse("INPUT_INVALID", parsed.problems.join("; "))
    const request = parsed.value
    if (request.source !== undefined && request.source !== "demo") return refuse("SOURCE_UNKNOWN", "This plugin lists only demo")
    const binding: CursorBinding = { plugin, source: "demo", account: "work", ...(request.scope ? { scope: request.scope } : {}) }
    const label = request.scope?.["label"]
    const inScope = items.filter((item) => label === undefined || item.labels.some((l) => (Array.isArray(label) ? label.includes(l) : l === label)))
    let from = 0
    if (request.cursor !== undefined) {
      const decoded = options.unbound ? { ok: true as const, state: JSON.parse(Buffer.from(request.cursor, "base64url").toString()) as Record<string, unknown> } : decodeBoundCursor(binding, request.cursor)
      if (!decoded.ok || typeof decoded.state["n"] !== "number") return refuse("CURSOR_INVALID", "The cursor was not issued for this source, account and scope")
      from = decoded.state["n"] as number
    } else {
      const since = startTime(request, T0 + 3_600_000)
      from = inScope.findIndex((item) => Date.parse(item.occurred_at) >= since)
      if (from === -1) from = inScope.length
    }
    const slice = inScope.slice(from, from + request.limit)
    const screened = options.leakSecret ? { events: slice, refused: [] } : screenEvents(slice)
    const next = from + slice.length
    const cursor = options.unbound ? Buffer.from(JSON.stringify({ n: next })).toString("base64url") : encodeBoundCursor(binding, { n: next })
    return eventsListResult(WHOSE, screened.events, cursor, next < inScope.length, {
      ...(options.echo === false || request.scope === undefined ? {} : { scope: request.scope }),
      refused: screened.refused,
    })
  }
}

describe("the conformance's opt-in checks", () => {
  const items = [event(0, { labels: ["inbox"] }), event(1, { labels: ["inbox"] }), event(2, { labels: ["inbox"], text: "token = ghp_abcdefghijklmnop1234" }), event(3, { labels: ["work"] }), event(4, { labels: ["inbox"] })]
  const fixtures = {
    source: "demo",
    account: "work",
    owner: OWNER,
    since: "2026-11-01T08:00:00Z",
    expected: ["item-0", "item-1", "item-4"],
    refused: ["item-2"],
    scope: { label: ["inbox"] },
    scopeEcho: true,
    binding: { plugin: "opencode-demo" },
    codes: true,
    kinds: ["message"],
    maxBytes: 65_536,
  }

  const { refused: _refused, ...withoutRefused } = fixtures

  test("pass a source that implements the final design", async () => {
    // Its pages hold 2 listed or refused items each, so the walk sees one refusal mid-page.
    expect(await eventsListConformance(finalSource(items), withoutRefused)).toEqual([])
    expect(await eventsListConformance(finalSource(items), fixtures)).toEqual([])
  })

  test("catch a missing echo, a cursor not bound, refusals without the table's codes, a leaked secret and an undeclared kind", async () => {
    expect(await eventsListConformance(finalSource(items, { echo: false }), fixtures)).toContainEqual("the first page: the result does not echo the scope")
    const unbound = await eventsListConformance(finalSource(items, { unbound: true }), fixtures)
    expect(unbound).toContainEqual("the first page's cursor is not the library's cursor bound to this plugin, source, account and scope")
    const uncoded = await eventsListConformance(finalSource(items, { codes: false }), fixtures)
    expect(uncoded).toContainEqual("a malformed cursor was refused without the code CURSOR_INVALID")
    expect(uncoded).toContainEqual(`a limit of 501 was refused without the code INPUT_INVALID`)
    const leaked = await eventsListConformance(finalSource(items, { leakSecret: true }), { ...fixtures, expected: ["item-0", "item-1", "item-2", "item-4"], refused: [] })
    expect(leaked).toContainEqual(expect.stringMatching(/the event item-2 holds a secret \(token\); it belongs in refused\[\]/))
    expect(await eventsListConformance(finalSource(items), { ...fixtures, kinds: ["meeting"] })).toContainEqual(expect.stringContaining("is a message, which the source does not declare"))
  })

  test("give Memory's kit every call, and add its problems after the walk", async () => {
    const calls: ConformanceCall[] = []
    const problems = await eventsListConformance(finalSource(items), {
      ...fixtures,
      hooks: { onCall: (call) => calls.push(call), after: ({ pages, whole }) => [`walked ${pages.length} pages; whole lists ${whole?.events.length}`] },
    })
    expect(problems).toEqual(["walked 2 pages; whole lists 3"])
    expect(calls.map((call) => call.what)).toContain("another account's bound cursor")
    expect(calls.filter((call) => call.error !== undefined).length).toBe(8)
  })
})
