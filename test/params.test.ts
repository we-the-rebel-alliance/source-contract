import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { isTimeZone, resolveParams, resolveRelativeTime, resolveSince, resolveWindow } from "../src/params.ts"

const NOW = new Date("2026-11-13T09:41:27.512Z")
const AMSTERDAM = { now: NOW, timeZone: "Europe/Amsterdam" }

describe("relative times", () => {
  test("resolve to UTC, rounded down to the minute (Artifacts' rule)", () => {
    assert.equal(resolveRelativeTime("now", AMSTERDAM), "2026-11-13T09:41:00.000Z")
    assert.equal(resolveRelativeTime("-90m", AMSTERDAM), "2026-11-13T08:11:00.000Z")
    assert.equal(resolveRelativeTime("+2h", AMSTERDAM), "2026-11-13T11:41:00.000Z")
    assert.equal(resolveRelativeTime("-7d", AMSTERDAM), "2026-11-06T09:41:00.000Z")
    assert.equal(resolveRelativeTime("+1w", AMSTERDAM), "2026-11-20T09:41:00.000Z")
  })

  test("give the same answer for every read within one minute", () => {
    const early = resolveRelativeTime("-1d", { now: new Date("2026-11-13T09:41:00.000Z"), timeZone: "UTC" })
    const late = resolveRelativeTime("-1d", { now: new Date("2026-11-13T09:41:59.999Z"), timeZone: "UTC" })
    assert.equal(early, late)
  })

  test("keep the time of day across a clock change when they move days", () => {
    // Amsterdam leaves summer time on 25 October 2026: 10:00 local on the 26th is 09:00Z, on the 24th 08:00Z.
    const monday = { now: new Date("2026-10-26T09:00:00Z"), timeZone: "Europe/Amsterdam" }
    assert.equal(resolveRelativeTime("-2d", monday), "2026-10-24T08:00:00.000Z")
    // Hours stay exact.
    assert.equal(resolveRelativeTime("-48h", monday), "2026-10-24T09:00:00.000Z")
  })

  test("refuse a malformed or out-of-bounds offset", () => {
    for (const value of ["7d", "-7", "-7y", "-367d", "-53w", "+999999d", "yesterday", " -7d"]) {
      assert.equal(resolveRelativeTime(value, AMSTERDAM), undefined, value)
    }
    assert.notEqual(resolveRelativeTime("-366d", AMSTERDAM), undefined)
  })
})

describe("windows", () => {
  test("run midnight to midnight in the person's time zone", () => {
    assert.deepEqual(resolveWindow("today", AMSTERDAM), { since: "2026-11-12T23:00:00.000Z", until: "2026-11-13T23:00:00.000Z" })
    assert.deepEqual(resolveWindow("yesterday", AMSTERDAM), { since: "2026-11-11T23:00:00.000Z", until: "2026-11-12T23:00:00.000Z" })
    assert.deepEqual(resolveWindow("tomorrow", { now: NOW, timeZone: "America/New_York" }), { since: "2026-11-14T05:00:00.000Z", until: "2026-11-15T05:00:00.000Z" })
  })

  test("follow the date where the person is, not in UTC", () => {
    // 23:30Z on the 13th is already the 14th in Tokyo.
    const late = { now: new Date("2026-11-13T23:30:00Z"), timeZone: "Asia/Tokyo" }
    assert.deepEqual(resolveWindow("today", late), { since: "2026-11-13T15:00:00.000Z", until: "2026-11-14T15:00:00.000Z" })
  })

  test("are 23 or 25 hours long on the day the clocks change", () => {
    const spring = resolveWindow("today", { now: new Date("2026-03-29T12:00:00Z"), timeZone: "Europe/Amsterdam" })
    assert.equal((Date.parse(spring.until) - Date.parse(spring.since)) / 3_600_000, 23)
    const autumn = resolveWindow("today", { now: new Date("2026-10-25T12:00:00Z"), timeZone: "Europe/Amsterdam" })
    assert.equal((Date.parse(autumn.until) - Date.parse(autumn.since)) / 3_600_000, 25)
  })
})

describe("resolveParams", () => {
  const declared = { window: { relative: true }, user: { me: true }, limit: {} }

  test("resolves windows, relative times and $me, and passes the rest to the plugin", () => {
    const resolved = resolveParams(declared, { window: "today", user: "$me", limit: 5 }, { ...AMSTERDAM, me: "slack:U123" })
    assert.deepEqual(resolved, {
      ok: true,
      value: { window: { since: "2026-11-12T23:00:00.000Z", until: "2026-11-13T23:00:00.000Z" }, user: "slack:U123", limit: 5 },
    })
    assert.deepEqual(resolveParams(declared, { window: { since: "-7d", until: "now" } }, AMSTERDAM), {
      ok: true,
      value: { window: { since: "2026-11-06T09:41:00.000Z", until: "2026-11-13T09:41:00.000Z" } },
    })
    assert.deepEqual(resolveParams(declared, { window: "2026-11-01" }, AMSTERDAM), { ok: true, value: { window: "2026-11-01" } })
    assert.deepEqual(resolveParams(declared, undefined, AMSTERDAM), { ok: true, value: {} })
  })

  test("refuses an undeclared param, $me where it is not declared or not known, and a bad window", () => {
    const refused = (given: unknown, context = AMSTERDAM) => {
      const checked = resolveParams(declared, given, context)
      assert.equal(checked.ok, false)
      return checked.ok ? "" : checked.problems.join("\n")
    }
    assert.match(refused({ colour: "red" }), /params.colour is not a param this source declares/)
    assert.match(refused({ limit: "$me" }), /may not be \$me/)
    assert.match(refused({ user: "$me" }), /signed-in account is not known/)
    assert.match(refused({ window: "fortnight" }), /params.window must be/)
    assert.match(refused({ window: { since: "now", until: "-1d" } }), /since is after/)
    assert.match(refused({ window: { from: "now" } }), /must be a window/)
    assert.match(refused([]), /params must be an object/)
    assert.match(refused({ window: "today" }, { now: NOW, timeZone: "Mars/Olympus" }), /not an IANA time zone/)
  })

  test("does not treat an inherited key as declared", () => {
    assert.equal(resolveParams(declared, { constructor: 1 }, AMSTERDAM).ok, false)
  })
})

describe("resolveSince", () => {
  test("resolves a relative since and keeps an absolute one", () => {
    assert.deepEqual(resolveSince("-3d", AMSTERDAM), { ok: true, value: "2026-11-10T09:41:00.000Z" })
    assert.deepEqual(resolveSince("2026-11-01T00:00:00+01:00", AMSTERDAM), { ok: true, value: "2026-11-01T00:00:00+01:00" })
    assert.equal(resolveSince("last week", AMSTERDAM).ok, false)
    assert.equal(resolveSince("2026-13-45", AMSTERDAM).ok, false)
  })

  test("knows real time zones", () => {
    assert.equal(isTimeZone("Europe/London"), true)
    assert.equal(isTimeZone("UTC"), true)
    assert.equal(isTimeZone("Nowhere/Else"), false)
    assert.equal(isTimeZone(""), false)
  })
})
