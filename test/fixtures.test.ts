// The nine event plugins' recorded events_list pages, replayed through the package's conformance.
//
// Each fixture is every call one eventsListConformance run made in the plugin's own test, against the plugin's own
// fake, with what it answered (test/fixtures/README.md). The runner checks that:
// - each fixture is sanitised: no secret pattern, local path, real email or outside URL host;
// - each run passes the package's conformance as recorded: contract 1's checks, the eleven kinds and the secret check;
// - each run passes with the extended page result: `plugin`, `asOf` and, for the billed X, `cost`, under the
//   descriptor's default `maxBytes` of 64 KB;
// - which plugins' refusals already carry the table's codes, so the migration list in CHANGES.md stays true;
// - every recorded cursor is a version 1 cursor of its source, and no recorded event would be refused as a secret.
import { describe, test } from "node:test"
import { expect } from "./support/expect.ts"
import { decodeCursor, eventsListConformance, MAX_BYTES, resultProblems, screenEvents, type SourceEvent } from "../src/events.ts"
import { loadFixtures, replay, type Fixture } from "./fixtures/replay.ts"
import { sanitisationProblems } from "./fixtures/sanitise.ts"

const FIXTURES = loadFixtures()
const PLUGINS = ["github", "granola", "gws", "history", "linear", "plaud", "slack", "wisprflow", "x"]
const AS_OF = "2026-11-13T00:00:00.000Z"

/** The kinds each plugin's recorded events use: what its descriptor's `reads` will name. */
const KINDS: Record<string, string[]> = {
  github: ["commit", "event", "issue", "pr"],
  granola: ["meeting"],
  gws: ["message"],
  history: ["session"],
  linear: ["issue"],
  plaud: ["meeting"],
  slack: ["message"],
  wisprflow: ["meeting"],
  x: ["message"],
}

/** The plugins whose refusals already carry the table's codes, directly or through contract 1's names. */
const CODED = ["github", "granola", "linear", "plaud", "slack", "wisprflow", "x"]

const results = (fixture: Fixture) => fixture.runs.flatMap((run) => run.calls.flatMap((call) => (call.result ? [call.result] : [])))
const events = (fixture: Fixture) => results(fixture).flatMap((result) => result["events"] as SourceEvent[])

/** The extended page: the draft's envelope fields, and X's cost in its two price units, as the provider would report. */
const extend = (fixture: Fixture) => (result: Record<string, unknown>) => {
  const listed = result["events"] as SourceEvent[]
  const authors = new Set(listed.flatMap((event) => event.actors.filter((actor) => actor.role === "author" || actor.role === "from").map((actor) => actor.id)))
  return {
    ...result,
    plugin: fixture.plugin,
    asOf: AS_OF,
    ...(fixture.source === "x" ? { cost: { units: [{ per: "post", count: listed.length }, { per: "author", count: authors.size }] } } : {}),
  }
}

describe("the fixtures", () => {
  test("are the nine plugins', with their provenance", () => {
    expect([...FIXTURES.keys()]).toEqual(PLUGINS)
    for (const [name, fixture] of FIXTURES) {
      expect(fixture.recordedFrom.repo, name).toBe(`joe-broadhead/opencode-${name}`)
      expect(fixture.recordedFrom.commit, name).toMatch(/^[0-9a-f]{40}$/)
      expect(fixture.runs.length, name).toBeGreaterThan(1)
    }
  })

  test("are sanitised", () => {
    for (const [name, fixture] of FIXTURES) expect(sanitisationProblems(fixture), name).toEqual([])
  })

  test("use only core kinds, as each plugin's descriptor will declare them", () => {
    for (const [name, fixture] of FIXTURES) expect([...new Set(events(fixture).map((event) => event.kind))].sort(), name).toEqual(KINDS[name])
  })

  test("hold only version 1 cursors of their own source", () => {
    for (const [name, fixture] of FIXTURES) {
      for (const result of results(fixture)) expect(decodeCursor(fixture.source, result["cursor"] as string) !== undefined, `${name} ${String(result["cursor"])}`).toBe(true)
    }
  })

  test("hold no event the secret-pattern refusal would refuse", () => {
    for (const [name, fixture] of FIXTURES) expect(screenEvents(events(fixture)).refused, name).toEqual([])
  })
})

for (const name of PLUGINS) {
  describe(name, () => {
    const fixture = FIXTURES.get(name)!

    test("passes the conformance as recorded", async () => {
      for (const [index, run] of fixture.runs.entries()) {
        const { list, missed } = replay(run)
        expect(await eventsListConformance(list, run.fixtures), `run ${index}`).toEqual([])
        expect(missed, `run ${index}`).toEqual([])
      }
    })

    test("passes with the extended page result, the declared kinds and the default maxBytes", async () => {
      for (const [index, run] of fixture.runs.entries()) {
        const { list, missed } = replay(run, extend(fixture))
        expect(await eventsListConformance(list, { ...run.fixtures, kinds: KINDS[name]!, maxBytes: MAX_BYTES.default }), `run ${index}`).toEqual([])
        expect(missed, `run ${index}`).toEqual([])
      }
      for (const result of results(fixture)) expect(resultProblems(extend(fixture)(result), 500, MAX_BYTES.default)).toEqual([])
    })

    test(`${CODED.includes(name) ? "carries" : "does not yet carry"} the table's codes on its refusals`, async () => {
      const problems = (await Promise.all(fixture.runs.map((run) => eventsListConformance(replay(run).list, { ...run.fixtures, codes: true })))).flat()
      if (CODED.includes(name)) expect(problems).toEqual([])
      else {
        expect(problems.length).toBeGreaterThan(0)
        for (const problem of problems) expect(problem).toMatch(/was refused without the code/)
      }
    })
  })
}
