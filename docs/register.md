# `register`

`register` writes a plugin's doors once (contract §9). A plugin's `src/index.ts` is:

```ts
import { Plugin } from "@opencode/plugin"
import { assertHost, register } from "@we-the-rebel-alliance/plugin-contract/register"
import { manifest } from "./manifest.ts"
import { handlers } from "./handlers/index.ts"

export default Plugin.define({
  id: manifest.plugin.name,
  async setup(ctx) {
    assertHost(ctx, manifest)
    const registration = await register(ctx, manifest, handlers)
    return () => registration.dispose()
  },
})
```

The returned registration carries the typed writer as `registration.bus`, and every handler call carries the same writer
as `call.bus` (§10), so a plugin needs no flag, no mutable placeholder and no second registration. Only the events the
manifest declares are registered; emitting an undeclared one answers `unavailable`. The registration's raw events
emitter stays inside `register`: `registration.bus` and `call.bus` are the only writers a plugin reaches.
A plugin never calls `ctx.rpc.register` itself, never adds a tool itself, and never evaluates a permission rule itself.

## The host gate

`assertHost(ctx, manifest)` reads `ctx.app.version` and the manifest's `plugin.host.opencode` range and refuses an
untested release with `HOST_UNTESTED` and a next step (`hostInRange` is the one predicate). A supported host returns, and
so does `options.allowUntestedHost: true`. Call it first in `setup`, before registering anything, so an untested host
leaves no half-wired plugin behind.

## The handler table

One handler per declared method, by the method's name:

```ts
const handlers = {
  events_list: {
    description: "List the messages in a channel.",
    input: { type: "object", properties: { channel: { type: "string" } }, required: ["channel"], additionalProperties: false },
    output: { type: "object", additionalProperties: true },
    async run(input, call) {
      return provider.list({ channel: input.channel, account: call.account, signal: call.signal })
    },
  },
}
```

| Field | Meaning |
|---|---|
| `description` | The agent tool's description. |
| `input` | The method's own JSON Schema object, without `account`. The register adds the account selector. |
| `output` | The answer's JSON Schema. A `plans` method answers `{ method, … }`; the register mints the `planId` and the door publishes `PLAN_OUTPUT`. |
| `run(input, call)` | The work. `call` carries the session, agent, message id, call id, signal, progress, resolved `account`, `bus`, `unguardedAgents()` and door. |

A method's `capabilities.methods` entry may also carry the handler's `description` and the live tool's full `input`
schema: `account` for a method that takes one, and `{ planId }` for a commit. Conformance (`T1.methods`) checks them
against the tool the register builds. A pass-through MCP row describes the vendor's tool, which T1 does not load, so its
values are the plugin's own claim; `mcp:*` carries neither field.

`register` refuses a declared method with no handler, a handler the manifest does not declare, and a handler for a
pass-through MCP method (`mcp:*`). A pass-through MCP method is declared in `methods` for its class and access rule; the
vendor's server owns its tool, so this module does not register or proxy it. Its tool name keeps the vendor's case,
so the action is `<server>_getJiraIssue`, not a lowercased rewrite.

A handler needs no state of its own. `call.bus` is the writer from the one RPC registration, and
`call.unguardedAgents()` asks the host for the agents whose rules no longer give every generated rule its effect; it
answers `{ ok: true, agents }` or `{ ok: false, error }` and never throws, so a status handler passes the result
straight to `statusAnswer`. A handler gets no access registration: nothing on the call can change the rules. Status
reads its agent answer from the call, so nothing is written after `register` returns.

## Doors 1–3

| Door | Registration | Permission action |
|---|---|---|
| 1 Agent tool | `ctx.tool.transform`, namespace `<name>`, one tool `<method>` | `<name>.<method>` |
| 2 Code Mode and automations | the same tool, `tools.<name>.<method>` | `<name>.<method>` |
| 3 RPC | one `ctx.rpc.register`, id `<name>`, method `<method>` | `<name>.<method>`, capped by `access` |

The tool's effective name in OpenCode is `<name>_<method>` (dots in a namespace become underscores); the namespace line
is the manifest's `plugin.summary`, which T0 keeps within 400 characters. A `pinned: true` method sets Code Mode's
`pinned` flag; no method is pinned by default.

`pinned: true` is the only Code Mode flag a method may set (`Tool.Options.codemode`, `@opencode/schema/dist/tool.d.ts`).
No method is pinned by default.

## RPC

```http
POST /api/rpc/<name>/<method>
{ "sessionID": "<session>", "input": <the method's input> }
```

The call runs as the session and agent it names, under the agent's rules followed by the session's — the order OpenCode
uses. The envelope is strict: an unknown key is `rpc.invalid_input`, not silently dropped.

Every call passes one gate, `ctx.permission.assert`, once (OpenCode 2.4.1 `PermissionDomain.assert`,
`@opencode/plugin/dist/promise/permission.d.ts`). A tool's `permission` option only hides a fully denied tool and
`tool.add` adds no ask, so the register calls the gate itself for every door. A **read** runs when the rules
allow it, or asks when they say `ask`; a `deny` refuses it. The plugin's own `access` level is final: a method
whose `effect` is `deny` is refused with `PERMISSION_DENIED` over RPC, a read too, even in a fenced session that
allows it; under `read-only` a non-read RPC call is refused even with a grant; under `ask-changes` or `all` it
needs an ask or a valid grant. An `allow` rule is not a confirmation. RPC asks never save: an answer applies to
that one call. A call's `signal` cancels a pending ask: the gate rejects the request it opened (found by the
call's source id, which every RPC ask carries) so nothing stays on the person's screen, refuses at once, and a
commit releases its plan instead of holding it until expiry.

A **non-read** method over RPC needs one of contract §8's two confirmations (LD-5):

- a permission ask: a rule resolves to `ask`, the gate prompts; a client answers and the call proceeds or is refused;
  or
- a host-signed action grant in the envelope, with the consumer it was issued to:

  ```json
  { "sessionID": "<session>", "input": { "planId": "<id>" }, "grant": "<compact token>", "consumer": "<consumer>" }
  ```

  The register verifies it with `verifyGrant` (`./grant`): audience, consumer, capability `<name>.<method>`, the
  action the method commits (or the method itself when it commits no action), account, manifest hash, exact input
  digest, time window, `cfm`, and single use through the plugin's durable store.

A non-read over RPC with only an allow rule is `PERMISSION_DENIED`; the next step names both ways to confirm it. A
saved "Always allow" from a tool door never confirms an RPC write: the register forces a fresh one-call ask (the
`evaluate` hook turns a saved allow back into `ask`), or a valid grant is the confirmation. A tool door saves only
`<account>:*` for its own method action, never a project-wide `*`.

The plugin passes the verifier's wiring to `register` as its fourth argument:

```ts
register(ctx, manifest, handlers, {
  grant: {
    keys: { keys: { host_2026_11: publicKeyPem } },
    audience: "@we-the-rebel-alliance/slack-plugin",
    store: { consume: (claims) => storage.claim(claims.jti) },
  },
})
```

An app's commit carries that grant: `act` previews with the action's `plans: true` method and commits with exactly
`{ planId }` plus the host-signed token for the commit method and that input. A plugin never calls `verifyGrant` itself;
`register` verifies the envelope's grant whenever the fourth argument wires the keys, the audience and the store.

## Input, account and output

The register resolves the account through the `accounts` module before the handler runs:

- `accounts: "optional"` methods take `account` in their input. With one account it may be left out; with more than one,
  leaving it out is `ACCOUNT_REQUIRED`, whose next step lists the aliases. An unknown alias is `ACCOUNT_UNKNOWN`.
- `accounts: "none"` methods refuse an `account` field with `INPUT_INVALID`.
- The handler receives the resolved alias as `call.account`, and the input without the selector.

The input is checked against the handler's schema (`INPUT_INVALID`), the answer against its output schema
(`SCHEMA_VIOLATION`). A schema with `additionalProperties: false` also refuses an unknown key. A plugin reuses the
package's output schemas instead of copying them: `STATUS_SCHEMA` from `accounts` for `status`, `PAGE_SCHEMA`
and `LIST_OPTIONS_SCHEMA` from `events` for an events source's `events_list` and its `list_*` scope suggest, and
`PROBE_SCHEMA` for any plugin's `probe` (its `source` is optional, so a plugin with no source uses it too).

A `plans: true` method answers the committing `method` and §8's preview fields it carries (`output`, `reaches`,
`changes`, `cost`, `trust`), and any private plan data; it must not answer a `planId` (`PLAN_INVALID`). The register
mints the `planId` itself with 128 random bits as base64url, copies the handler's full answer with `structuredClone`
(so neither the handler nor the public answer can change the stored plan), and publishes only
`{ planId, method, output?, reaches?, changes?, cost?, trust? }`. It never reuses a live id. A stored plan is at most
`PLAN_MAX_BYTES` (64 KB of JSON); an answer a copy cannot carry, or one over the cap, is `PLAN_INVALID` with a next step.

**Put everything the commit will write into the preview fields the person sees.** `output`, `reaches`, `changes`,
`cost` and `trust` are the confirmation; private plan data is only for what the preview cannot show, such as an opaque
handle the provider issued. The commit must not trust anything the person did not see: a value the person could not
review must not change what the commit writes.

A `commits: "<plan>"` method accepts exactly `{ planId }` from that plan, with no `account`, and receives the plan
handler's full answer as `call.plan`; its answer is checked against the handler's own output schema, and an app's `act`
expects `{ output, trust }` and checks `output` against the action's `output`. The register stores each
plan's account (and expiry, 15 minutes) in the plugin instance: a commit runs as that account, and its permission gate
names that account. A `planId` commits once, only through the method its plan named; a second commit is `PLAN_USED` and
another method is `PLAN_INVALID`. A commit reserves the plan before its permission ask or grant check; a refusal
releases it, and the handler's start consumes it, so a failed handler still uses the plan. A handler starts only when
its reservation still holds a live plan; an expired plan refuses the call (`PLAN_INVALID`) and the handler does not run.
An unknown or expired `planId` is `PLAN_INVALID`, and a `planId` from before a reload is unknown to the new plugin
instance. A grant for a commit must name the plan's account; another account is `ACCOUNT_MISMATCH`. The handler's own
input schema is not used for a commit.

## Permissions on operations

The one gate asks the method's action `<name>.<method>` on `<alias>:<operation>` for each declared operation, or on
`<alias>:*` when the method declares none. Pass-through MCP tools keep their own `<server>_<tool>` access rules, one
per alias, so a rule for `work` never reaches another alias's tools. A denied or rejected gate is
`PERMISSION_DENIED`.

## Errors

Every failure reads `CODE: What happened. Next step: What to do.` (contract §12):

| Code | When |
|---|---|
| `INPUT_INVALID` | The input is not an object, breaks the handler's schema, or names an account a `none` method cannot take. |
| `SCHEMA_VIOLATION` | The answer breaks the handler's output schema. |
| `PLAN_INVALID` | A plan or commit does not carry the contract's shape, names the wrong committing method, or is unknown/expired. |
| `PLAN_USED` | The plan was already committed once. |
| `ACCOUNT_REQUIRED`, `ACCOUNT_UNKNOWN` | The account cannot be resolved through `accounts`. |
| `PERMISSION_DENIED` | A rule denies the call, an ask is rejected, or a non-read RPC call has no ask or grant. |
| `GRANT_INVALID` | A grant did not verify, for any reason the verifier publishes. |
| `NEEDS_SIGN_IN` | A handler reports a sign-in failure with the contract's own code. |
| `UNAVAILABLE` | Any other handler failure, cut to one line and redacted. |

`register` maps a handler's own refusal (an error with `code`, `next` and `what`, or a `RegisterError`) to itself. A
code the table does not hold is `UNAVAILABLE`. A sign-in failure must use `NEEDS_SIGN_IN`; an older transport's
`AUTH_REQUIRED` is not a contract code and is reported as `UNAVAILABLE`.

## Telemetry

Every call through doors 1 and 3 writes one event in the contract's envelope (§19), before the door answers:

| Event | When |
|---|---|
| `plugin.read` | a read returned |
| `plugin.plan` | a planning call returned a plan |
| `plugin.commit` | a commit, or another non-read method, ran |
| `plugin.refused` | the call did not return, with the contract code that refused it |

The event carries the method, its class and effect, the account alias, the consumer, `allowed_by` (`grant`, `ask`,
`rule` or `none`), the outcome (`ok` or the code), and the duration. A `plugin.read` also carries the number of events
the page returned (zero when the answer has no page) and, when the provider reports it, its `cost.usd`.

`register` never writes a tool's input or answer, provider text, a credential or a grant. The subject holds pseudonymous
agent and session ids, never the raw ids.

The log is local JSON Lines: `wiring.telemetry.path` when the host gives one, otherwise
`$XDG_DATA_HOME/opencode/plugin-data/<name>/events.jsonl`, or `~/.local/share/opencode/plugin-data/<name>/events.jsonl`
when `XDG_DATA_HOME` is unset. The source names the plugin, `wiring.telemetry.version` (default `unknown`) and
`wiring.telemetry.deployment` (default `local`). A log that cannot be written is skipped, and the call's answer is
unchanged:

```ts
const registration = await register(ctx, manifest, handlers, {
  telemetry: { path: "/var/lib/slack-plugin/events.jsonl", version: packageVersion, deployment: "work" },
})
```

## OpenCode 2.4.1 types

The register uses only the public plugin context (`@opencode/plugin` 2.4.1): `Plugin.Context.agent`, `.tool`, `.rpc`,
`.session`, `.permission` and `.options` (`dist/promise/plugin.d.ts`); `setup` returns a cleanup function or nothing. The structural declarations in
`src/register/*.ts` keep those types out of the published `.d.ts`; the compile-time checks name the host types. The tool
registration follows `ToolEditor.add` and `Tool.Options.codemode` (`dist/promise/tool.d.ts`,
`@opencode/schema/dist/tool.d.ts`); the RPC registration follows `RpcDomain.register` and `RpcRegistration`
(`dist/promise/rpc.d.ts`, `dist/promise/registration.d.ts`); the permission ask follows `PermissionDomain.assert`
(`dist/promise/permission.d.ts`).

## Exports

| Export | Does |
|---|---|
| `register` | doors 1–3 from one handler table, a manifest and the optional grant wiring; the registration carries the bus writer |
| `assertHost`, `HostContext` | the host gate: `ctx.app.version` against the manifest's range, refusing `HOST_UNTESTED` |
| `RegisterContext`, `RegisterWiring`, `Registration`, `GrantWiring`, `TelemetryWiring` | the context it takes, the grant and telemetry wiring, and what it returns (its `bus` and its disposer) |
| `methodEntries`, `Door`, `HandlerTable`, `MethodCall`, `MethodEntry`, `MethodHandler` | the handler table and one call's context: `account`, `bus` and `unguardedAgents()` |
| `COMMIT_INPUT`, `PLAN_OUTPUT`, `PLAN_MAX_BYTES` | the shapes a planning method answers and a commit takes, and the most bytes of JSON a stored plan may take |
| `refusal`, `refusalOf`, `RegisterError`, `Refusal` | a handler's own refusal, in the contract's form |
