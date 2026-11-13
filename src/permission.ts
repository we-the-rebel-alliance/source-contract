/**
 * Permission: the exact OpenCode session rules a grant allows (design §3, "the trust rule").
 *
 * Every read runs in a session limited to these rules. OpenCode checks each inner tool call a plugin makes against the
 * calling session's rules, and the last matching rule wins, so the rules are a deny of everything, then one allow per
 * action and resource the source declares:
 *
 *   [{ action: "*", resource: "*", effect: "deny" },
 *    { action: "gws.events_list", resource: "*", effect: "allow" },
 *    { action: "gws.read", resource: "ana@example.com:gmail.users.messages.list", effect: "allow" }, …]
 *
 * The method's action is allowed on `*`, because the tools RPC resolves a method before dispatch on `*` (version 2; a
 * method with a version 2.3 resource resolver is resolved on its resource, which the operation rules cover). Each
 * operation is allowed as Memory's schema and conformance kit read it (`operationRule`): a dotted operation as
 * `<namespace>.read` on `<account>:<operation>` (gws: `gws.read` on `ana@example.com:gmail.users.messages.get`), and a
 * bare one, an MCP tool, as `<namespace>_<operation>` on `*` (Slack: `slack_slack_read_channel`). The namespace is the
 * source id's first segment.
 *
 * The broker and a project may only narrow these rules, and the plugin's own `access` setting stays final.
 */
import type { Checked } from "./internal/checked.ts"
import type { SourceItem } from "./descriptor.ts"

/** One OpenCode permission rule, as a session or an agent holds it. */
export interface PermissionRule {
  readonly action: string
  readonly resource: string
  readonly effect: "allow" | "deny" | "ask"
}

/**
 * A person's grant: one consumer may read one source, for one account, within one scope (design §2, "consent per
 * (consumer, source, account, scope)").
 */
export interface Grant {
  /** Who reads: a project's consumer, such as `memory`, `jelly.home`, or an Artifacts app with its viewer. */
  readonly consumer: string
  /** The source id. */
  readonly source: string
  /** The account the person confirmed. */
  readonly account: string
  /** The scope the person confirmed, by scope key: channel ids, label names. Absent for a source without a scope. */
  readonly scope?: Readonly<Record<string, readonly string[]>>
  /** The descriptor hash the person consented to; a changed descriptor asks again. */
  readonly descriptorHash: string
  /** The person turned this binding off: a read answers SOURCE_DISABLED, which is not an error state. */
  readonly disabled?: boolean
}

/** The first rule of every fenced session: nothing is allowed that a later rule does not allow. */
export const DENY_ALL: PermissionRule = { action: "*", resource: "*", effect: "deny" }

/**
 * An account a rule may name: no wildcard (`*`, `?`), no `:` (it separates account and operation), no whitespace or
 * control character, at most 320 characters. A wildcard here would widen the grant to other accounts.
 */
export const ACCOUNT_PATTERN = /^[^\s*?:\u0000-\u001f\u007f]{1,320}$/

/** The wildcard characters OpenCode's rules read: an action or operation with one would widen a rule. */
const WILDCARD = /[*?]/

/** Why `account` cannot be named in a rule, or undefined when it can. */
export function accountProblem(account: unknown): string | undefined {
  if (typeof account !== "string" || !ACCOUNT_PATTERN.test(account)) {
    return "the account must be 1 to 320 characters with no wildcard (* or ?), no colon and no whitespace"
  }
  return undefined
}

const allow = (action: string, resource: string): PermissionRule => ({ action, resource, effect: "allow" })

/** A source's namespace: its id's first segment, which every action of the source begins with. */
export function namespaceOf(source: Pick<SourceItem, "id">): string {
  return source.id.split(".")[0] ?? source.id
}

/**
 * The rule that allows one operation for `account`: a dotted operation as `<namespace>.read` on
 * `<account>:<operation>`, a bare one (an MCP tool) as `<namespace>_<operation>` on `*`. The same derivation as Memory's
 * conformance kit, so declared equals asserted means the same thing in a plugin's CI and in a consumer's session.
 */
export function operationRule(source: Pick<SourceItem, "id">, operation: string, account: string): PermissionRule {
  const namespace = namespaceOf(source)
  return operation.includes(".") ? allow(`${namespace}.read`, `${account}:${operation}`) : allow(`${namespace}_${operation}`, "*")
}

function fenced(rules: readonly PermissionRule[]): Checked<readonly PermissionRule[]> {
  const loose = rules.find((rule) => WILDCARD.test(rule.action) || (rule.resource !== "*" && WILDCARD.test(rule.resource)))
  if (loose) return { ok: false, problems: [`the rule for ${loose.action} on ${loose.resource} has a wildcard, which would widen the grant`] }
  const seen = new Set<string>()
  const unique = rules.filter((rule) => {
    const key = `${rule.action}\u0000${rule.resource}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { ok: true, value: [DENY_ALL, ...unique] }
}

/** The method action a source's read asserts. */
export function methodAction(source: SourceItem): string | undefined {
  return source.kind === "events" ? source.permission.events : source.permission.tool
}

/**
 * The session rules for reading `source` under `grant`: deny everything, then allow the method and each declared
 * operation for the granted account. Refused when the grant is for another source, its account cannot be named in a
 * rule, or the source does not name its method's action.
 */
export function sessionRules(source: SourceItem, grant: Pick<Grant, "source" | "account">): Checked<readonly PermissionRule[]> {
  if (grant.source !== source.id) return { ok: false, problems: [`the grant is for ${grant.source}, not ${source.id}`] }
  const problem = accountProblem(grant.account)
  if (problem) return { ok: false, problems: [problem] }
  const method = methodAction(source)
  if (method === undefined) return { ok: false, problems: [`${source.id} names no action for its method`] }
  return fenced([allow(method, "*"), ...source.permission.operations.map((operation) => operationRule(source, operation, grant.account))])
}

/**
 * The session rules for one detail read of `source` under `grant`: the source's own rules. A detail read is part of
 * the source's read (Slack's thread read is one of its declared operations), so it asserts nothing the source does not
 * declare. Refused when the source declares no such detail.
 */
export function detailRules(source: SourceItem, detailId: string, grant: Pick<Grant, "source" | "account">): Checked<readonly PermissionRule[]> {
  if (!source.details?.some((entry) => entry.id === detailId)) return { ok: false, problems: [`${source.id} declares no detail read ${detailId}`] }
  return sessionRules(source, grant)
}

/**
 * The session rules for the source's `probe` on `account`: deny everything, then allow the source's own action and its
 * identity operations, which read no content and are never among its content operations (Memory's kit checks both).
 * The descriptor does not list identity operations yet, so the caller passes them (source-contract#4).
 */
export function probeRules(source: SourceItem, account: string, identityOperations: readonly string[]): Checked<readonly PermissionRule[]> {
  const problem = accountProblem(account)
  if (problem) return { ok: false, problems: [problem] }
  const method = methodAction(source)
  if (method === undefined) return { ok: false, problems: [`${source.id} names no action for its method`] }
  const content = identityOperations.filter((operation) => source.permission.operations.includes(operation))
  if (content.length > 0) return { ok: false, problems: [`${content.join(", ")} is a content operation of ${source.id}, so a probe may not assert it`] }
  return fenced([allow(method, "*"), ...identityOperations.map((operation) => operationRule(source, operation, account))])
}

/**
 * How OpenCode decides an action on a resource under `rules`: the last rule whose action and resource match wins (`*`
 * matches any run of characters and `?` one), and no match asks. The same evaluation the tools RPC runs.
 */
export function evaluate(rules: readonly PermissionRule[], action: string, resource = "*"): PermissionRule["effect"] {
  return rules.findLast((rule) => wildcard(rule.action, action) && wildcard(rule.resource, resource))?.effect ?? "ask"
}

const wildcard = (pattern: string, value: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(value)

/** True when `grant` covers a read of `source` for `account` within `scope`: the same source and account, and every scope value granted. */
export function grantCovers(grant: Grant, request: { readonly source: string; readonly account: string; readonly scope?: Readonly<Record<string, readonly string[]>> }): boolean {
  if (grant.source !== request.source || grant.account !== request.account) return false
  for (const [key, values] of Object.entries(request.scope ?? {})) {
    const granted = grant.scope?.[key]
    if (!granted || values.some((value) => !granted.includes(value))) return false
  }
  return true
}
