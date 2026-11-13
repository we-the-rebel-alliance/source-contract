import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import type { SourceItem } from "../src/descriptor.ts"
import { accountProblem, DENY_ALL, detailRules, evaluate, grantCovers, namespaceOf, operationRule, probeRules, sessionRules, type Grant } from "../src/permission.ts"
import type { Checked } from "../src/index.ts"

const problemsIn = (checked: Checked<unknown>): readonly string[] => (checked.ok ? [] : checked.problems)

const items = (name: string): SourceItem[] => JSON.parse(readFileSync(new URL(`./descriptors/${name}/package.json`, import.meta.url), "utf8")).sources.items
const [gmail, today] = items("gws") as [SourceItem, SourceItem]
const [slack] = items("slack") as [SourceItem]
const ana = "ana@example.com"

const rulesOf = (checked: ReturnType<typeof sessionRules>) => {
  assert.equal(checked.ok, true, checked.ok ? "" : checked.problems.join("\n"))
  return checked.ok ? checked.value : []
}

describe("sessionRules", () => {
  test("gws: deny everything, allow the method on *, and each operation on <account>:<operation>", () => {
    assert.deepEqual(rulesOf(sessionRules(gmail, { source: "gws.gmail", account: ana })), [
      DENY_ALL,
      { action: "gws.events_list", resource: "*", effect: "allow" },
      { action: "gws.read", resource: `${ana}:gmail.users.history.list`, effect: "allow" },
      { action: "gws.read", resource: `${ana}:gmail.users.messages.list`, effect: "allow" },
      { action: "gws.read", resource: `${ana}:gmail.users.messages.get`, effect: "allow" },
    ])
  })

  test("Slack: each bare operation is an MCP tool, allowed as <namespace>_<operation> on *", () => {
    assert.deepEqual(rulesOf(sessionRules(slack, { source: "slack.workspace", account: "T0123" })), [
      DENY_ALL,
      { action: "slack_events_list", resource: "*", effect: "allow" },
      { action: "slack_slack_read_channel", resource: "*", effect: "allow" },
      { action: "slack_slack_read_thread", resource: "*", effect: "allow" },
    ])
  })

  test("derive each operation's rule as Memory's conformance kit does", () => {
    assert.deepEqual(operationRule(gmail, "gmail.users.messages.get", ana), { action: "gws.read", resource: `${ana}:gmail.users.messages.get`, effect: "allow" })
    assert.deepEqual(operationRule(slack, "slack_read_channel", "T0123"), { action: "slack_slack_read_channel", resource: "*", effect: "allow" })
    assert.equal(namespaceOf(today), "gws")
  })

  test("fence a session exactly: what is declared runs, nothing else does, and no other account", () => {
    const rules = rulesOf(sessionRules(gmail, { source: "gws.gmail", account: ana }))
    // The session's rules come after the agent's: even an agent that allows everything is fenced.
    const session = [{ action: "*", resource: "*", effect: "allow" as const }, ...rules]
    assert.equal(evaluate(session, "gws.events_list"), "allow")
    assert.equal(evaluate(session, "gws.read", `${ana}:gmail.users.messages.get`), "allow")
    assert.equal(evaluate(session, "gws.read", "ben@example.com:gmail.users.messages.get"), "deny")
    assert.equal(evaluate(session, "gws.read", `${ana}:gmail.users.messages.send`), "deny")
    assert.equal(evaluate(session, "gws.send", "*"), "deny")
    assert.equal(evaluate(session, "bash", "*"), "deny")
    assert.equal(evaluate(rulesOf(sessionRules(today, { source: "gws.calendar.today", account: ana })), "gws.read", `${ana}:gmail.users.messages.get`), "deny")
  })

  test("refuse an account that would widen a rule, and a grant for another source", () => {
    for (const account of ["*", "ana*", "a?a", "ana:evil", "ana b", "", "x".repeat(321)]) {
      assert.equal(sessionRules(gmail, { source: "gws.gmail", account }).ok, false, account)
      assert.ok(accountProblem(account))
    }
    assert.equal(accountProblem(ana), undefined)
    assert.equal(sessionRules(gmail, { source: "gws.calendar.today", account: ana }).ok, false)
  })

  test("refuse a declared action or operation with a wildcard", () => {
    const loose = { ...gmail, permission: { ...gmail.permission, operations: ["gmail.*"] } }
    assert.match(problemsIn(sessionRules(loose, { source: "gws.gmail", account: ana }))[0]!, /wildcard/)
  })
})

describe("detail and probe rules", () => {
  test("a detail read runs under the source's own rules", () => {
    const rules = detailRules(slack, "slack.workspace.thread", { source: "slack.workspace", account: "T0123" })
    assert.deepEqual(rules, sessionRules(slack, { source: "slack.workspace", account: "T0123" }))
    assert.equal(detailRules(slack, "slack.nothing", { source: "slack.workspace", account: "T0123" }).ok, false)
  })

  test("a probe is fenced to the source's action and its identity operations, which are never content", () => {
    const rules = probeRules(gmail, ana, ["gmail.users.getProfile"])
    assert.ok(rules.ok)
    assert.equal(evaluate(rules.value, "gws.events_list"), "allow")
    assert.equal(evaluate(rules.value, "gws.read", `${ana}:gmail.users.getProfile`), "allow")
    assert.equal(evaluate(rules.value, "gws.read", `${ana}:gmail.users.messages.get`), "deny")
    assert.match(problemsIn(probeRules(gmail, ana, ["gmail.users.messages.get"]))[0]!, /content operation/)
    assert.equal(probeRules(gmail, "*", []).ok, false)
  })
})

describe("grantCovers", () => {
  const grant: Grant = { consumer: "memory", source: "slack.workspace", account: "T0123", scope: { channels: ["C01", "C02"] }, descriptorHash: "sha256:x" }

  test("covers the same source and account within the granted scope only", () => {
    assert.equal(grantCovers(grant, { source: "slack.workspace", account: "T0123", scope: { channels: ["C01"] } }), true)
    assert.equal(grantCovers(grant, { source: "slack.workspace", account: "T0123" }), true)
    assert.equal(grantCovers(grant, { source: "slack.workspace", account: "T0123", scope: { channels: ["C01", "C03"] } }), false)
    assert.equal(grantCovers(grant, { source: "slack.workspace", account: "T9999", scope: { channels: ["C01"] } }), false)
    assert.equal(grantCovers(grant, { source: "gws.gmail", account: "T0123" }), false)
    assert.equal(grantCovers(grant, { source: "slack.workspace", account: "T0123", scope: { labels: ["INBOX"] } }), false)
  })
})
