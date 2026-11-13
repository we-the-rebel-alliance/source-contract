/**
 * The recording permission context: a session whose rules are exactly a source's grants. Every read the kit calls runs
 * with this context, so a read that asserts more than its declaration holds is refused here, and a grant nothing
 * asserts is reported at the end. Declared equals asserted.
 */
import type { SourceItem } from "../schema/types.ts"

/** A permission action and its resource, as a declaration derives them. */
export interface Grant {
  readonly action: string
  readonly resource: string
}

/** One permission the plugin asserted while the kit ran it. */
export interface Assertion {
  readonly action: string
  readonly resources: readonly string[]
}

/** What a plugin's read may pass to `permission.assert`. */
export interface AssertInput {
  readonly action: string
  readonly resources?: readonly string[] | undefined
}

/** The context every conformance call receives: the account, and the session's permission. */
export interface SessionContext {
  readonly account: string
  readonly permission: { assert(input: AssertInput): Promise<void> }
}

/** A recording context: its permission, every assertion made through it, and every action it refused. */
export interface RecordingPermission {
  readonly permission: { assert(input: AssertInput): Promise<void> }
  readonly assertions: readonly Assertion[]
  readonly undeclared: readonly string[]
}

const key = (action: string, resource: string): string => `${action}\u0000${resource}`

/**
 * The grants a source's declaration derives, which are the running session's exact rules.
 *
 * **Provisional.** The app's `permission` module owns this derivation; until it lands, the kit derives the grants itself
 * so a plugin can pass conformance, and a caller may pass its own with `grants`. §2.2 keeps `permission.operations` and
 * the tool's action, not the grants themselves: a dotted operation is the account's own resource on the plugin's read
 * action (`gws.read` on `{account}:gmail.users.messages.get`), and a bare operation is an MCP tool's own action
 * (`slack_slack_read_channel` on `*`). Both forms are what the gws and Slack pilots assert.
 *
 * Not exported from the package: it is the kit's own reading, not a contract.
 */
export function grantsFor(source: SourceItem): Grant[] {
  const action = source.kind === "events" ? source.permission.events : source.permission.tool
  const grants: Grant[] = [{ action, resource: "*" }]
  for (const operation of source.permission.operations) addGrant(grants, source, operation)
  return grants
}

/**
 * The grants of the **bind** session: only `scope.suggest`'s tool and operations. They never enter a running grant, so
 * they are a separate session with its own unused check.
 */
export function bindGrantsFor(source: SourceItem): Grant[] {
  const suggest = source.scope?.suggest
  if (suggest === undefined) return []
  const action = source.kind === "events" ? source.permission.events : source.permission.tool
  const head = source.id.split(".")[0] ?? source.id
  const grants: Grant[] = [{ action: action.includes(".") ? `${head}.${suggest.tool}` : `${head}_${suggest.tool}`, resource: "*" }]
  for (const operation of suggest.operations) addGrant(grants, source, operation)
  return grants
}

/**
 * The grants of the identity operations a probe may assert. They are part of the running session, because a source's
 * page reads its identity too, but they are not content: a declaration may not also list one in
 * `permission.operations`.
 */
export function identityGrantsFor(source: SourceItem, identityOperations: readonly string[]): Grant[] {
  const grants: Grant[] = []
  for (const operation of identityOperations) addGrant(grants, source, operation)
  return grants
}

/** One operation's grant, as the same derivation makes it. */
function addGrant(grants: Grant[], source: SourceItem, operation: string): void {
  const head = source.id.split(".")[0] ?? source.id
  const grant: Grant = operation.includes(".")
    ? { action: `${head}.read`, resource: `{account}:${operation}` }
    : { action: `${head}_${operation}`, resource: "*" }
  if (!grants.some((held) => held.action === grant.action && held.resource === grant.resource)) grants.push(grant)
}

/** `{account}` is a wildcard for the account a call names; everything else must match exactly, or by `*`. */
export function sameResource(declared: string, asserted: string): boolean {
  if (declared === asserted || declared === "*") return true
  if (declared.startsWith("{account}:")) {
    return wildcard(declared.slice("{account}:".length), asserted.replace(/^[^:]*:/, ""))
  }
  return wildcard(declared, asserted)
}

/** True when some assertion is the grant's action on one of its resources, with `{account}` bound to any account. */
export function assertionMatches(assertions: readonly Assertion[], grant: Grant): boolean {
  return assertions.some(
    (assertion) =>
      assertion.action === grant.action && (assertion.resources.length > 0 ? assertion.resources : ["*"]).some((resource) => sameResource(grant.resource, resource)),
  )
}

/**
 * A recording permission over `grants`. An action outside them is refused the way the host refuses one, and listed in
 * `undeclared`; every assertion is recorded, so a caller can compare what the declaration holds with what was asked.
 */
export function recordingPermission(grants: readonly Grant[]): RecordingPermission {
  const held = new Set(grants.map((grant) => key(grant.action, grant.resource)))
  const assertions: Assertion[] = []
  const undeclared: string[] = []
  const permission = {
    async assert(input: AssertInput): Promise<void> {
      const resources = input.resources ?? ["*"]
      assertions.push({ action: input.action, resources })
      const allowed = resources.every((resource) =>
        [...held].some((entry) => {
          const [action, heldResource] = entry.split("\u0000")
          return sameResource(heldResource ?? "", resource) && wildcard(action ?? "", input.action)
        }),
      )
      if (!allowed) {
        undeclared.push(input.action)
        throw Object.assign(
          new Error(`PERMISSION_DENIED: ${input.action} needs a grant this declaration does not hold. Next step: declare the action and its resource in the sources declaration.`),
          { _tag: "Tool.Error" },
        )
      }
    },
  }
  return { permission, assertions, undeclared }
}

/** The grants a set of assertions never touched: a declaration that over-grants. */
export function unusedGrants(grants: readonly Grant[], assertions: readonly Assertion[]): Grant[] {
  return grants.filter((grant) => !assertionMatches(assertions, grant))
}

const wildcard = (pattern: string, value: string): boolean => {
  const expression = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*").replaceAll("?", ".")
  return new RegExp(`^${expression}$`).test(value)
}
