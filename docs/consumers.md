# How an app uses the contract

This page is the whole journey for an app: discover the installed plugins, read a source with a cursor, subscribe to
nudges, preview and commit a write, and confirm a write from an app UI with no agent. Every call is against this
package's modules; the host calls an app implements are marked as such.

An app owns placement, rendering, consent screens, cadence, budgets, caches and cursors (contract §2). It does not own
provider calls, credentials or permission enforcement. Pull is the truth: cursors and snapshots carry correctness, and a
bus event is only a nudge.

## 1. Discover the installed plugins

`listInstalledPlugins` is the catalog plugin's call. It asks the host which plugins are installed, reads each package's
`capabilities` from disk, validates it with the `manifest` module and hashes it.

```ts
import { listInstalledPlugins } from "@we-the-rebel-alliance/plugin-contract/catalog"

const listing = await listInstalledPlugins(ctx) // a catalog plugin's own context
for (const plugin of listing.plugins) {
  plugin.package       // "@we-the-rebel-alliance/acme-plugin", from its package.json
  plugin.version       // the installed version
  plugin.manifest      // the validated capabilities
  plugin.hash          // "sha256:…", the hash a grant stores
  plugin.manifest.sources   // the reads an app may bind to
  plugin.manifest.actions   // the writes an app may offer
}
listing.problems       // packages that could not be read, one entry each
```

The catalog plugin is its own repository; it serves this listing (`catalog.list`) and its broker (`broker.read`,
`broker.act`) over RPC. An app that runs beside OpenCode can call `listInstalledPlugins` itself with its own context. An
app that cannot read the disk receives the same `CatalogListing` from its catalog plugin and trusts one pinned RPC id,
never a manifest that arrived over RPC.

`plugin.hash` is the manifest's hash. Store it with the person's consent; a changed manifest changes the hash, and
`read` and `act` refuse a grant for another hash until the person consents again.

## 2. Read a source

A read runs under a grant: one consumer, one source, one account, one scope and one manifest hash. The app supplies a
`ReadHost`: three calls over its own OpenCode server. The first opens a session whose rules are exactly the grant's; the
second reads the plugin's `status`; the third calls the plugin's RPC method in that session.

```ts
import type { ReadHost } from "@we-the-rebel-alliance/plugin-contract/read"

const host: ReadHost = {
  async openSession({ rules, title }) {
    // This app's own OpenCode call: a session with exactly these permission rules.
    const session = await app.openFencedSession({ rules, title })
    return { sessionID: session.id, close: () => app.closeSession(session.id) }
  },
  async status({ package: packageName }) {
    // The plugin's own status method (contract §11): its accounts are the aliases a fence may name.
    return app.pluginStatus(packageName)
  },
  async call({ package: packageName, method, sessionID, input, grant, consumer, signal }) {
    // The host maps the package to its plugin id. The wire call is POST /api/rpc/<name>/<method>
    // with { sessionID, input }; an act commit adds grant and consumer. This app's client owns the URL and auth.
    return app.rpc(packageName, method, { sessionID, input, ...(grant === undefined ? {} : { grant, consumer }) }, signal)
  },
}
```

Then one read:

```ts
import { read } from "@we-the-rebel-alliance/plugin-contract/read"

const outcome = await read(host, {
  installed,                              // the CatalogPlugin from step 1
  source: "acme.messages",
  grant,                                  // { consumer, source, account, scope?, manifestHash }
  consumer: "notes",                      // the grant key: this app, or this app and its viewer
  since: "-1d",                           // an events read; resolved in the person's time zone
  limit: 100,
  context: { now: Date.now(), timeZone: "Europe/Amsterdam" },
})

if (!outcome.ok) {
  show(outcome.failure)                   // { code, message, next, retryAfterSec? }
} else if (outcome.kind === "events") {
  await applyEvents(outcome.page.events)
  if (!outcome.page.failed?.length) await saveCursor(outcome.page.cursor) // see Cursors
} else {
  render(outcome.snapshot)                // { data, asOf, cost?, trust: "untrusted" }
}
```

What `read` checks before it calls anything: the source is declared, the grant is this consumer's for the installed
manifest hash, the person has not turned the source off, the requested scope is inside the grant, and the inputs suit
the source — an events read may carry `cursor`, `since`, `limit` and `thumbnails`; a snapshot read may carry `pick`,
whose paths must be in its output schema. The answer is checked for its account, `trust: "untrusted"`, its size against
the source's `maxBytes`, and its page or output shape. A refused or failed read is a value, never a throw.

The aliases are the account names the person configured for the plugin, and they come from the plugin's own
`status.accounts` (contract §11), never from the caller: `read`, `readDetail`, `probe` and `act` call
`statusAliases(host, installed)` before any fenced call, so a host must implement `status`. A host without it, or a
status that lists no accounts for a plugin that declares them, is `UNAVAILABLE`; a source with provider operations
needs the grant's account in that list, or the fence refuses the read with `PERMISSION_DENIED` rather than inventing a
server name.

### Cursors

An events page carries `cursor` and `more`. The app keeps the cursor; `read` stores nothing. Save it in the same
transaction as the events it accepts:

```ts
const page = outcome.page
await applyEvents(page.events)          // then the removals
await applyRemovals(page.removals ?? [])
if (!page.failed?.length) await saveCursor(page.cursor)
```

- `refused[]` events are never delivered (a secret, instruction-shaped text from someone else, another owner); the app
  may advance past them. They do not hold the cursor back.
- `failed[]` events could not be read this time. Any entry there holds the cursor back: do not save past it.
- `more: false` is not "done". A later call may list new events; the next scheduled read uses the saved cursor.
- A cursor the source did not issue is `CURSOR_INVALID`, never a silent restart. A lost window is `CURSOR_EXPIRED` or a
  `gap` on the page; render the gap, do not invent the missing events.

The cursor is opaque. An app stores the string; it never decodes or edits it. The `cursor` module is the plugin's codec.

### Detail reads and probe

An event may name a detail read in its source (`details`). `readDetail` takes only the fields the detail's `from` names,
from the event as the source listed it, and runs in a session fenced by the source's rules plus the detail's method:

```ts
import { readDetail } from "@we-the-rebel-alliance/plugin-contract/read"

const thread = await readDetail(host, {
  installed,
  source: "acme.messages",
  detail: "acme.messages.thread",
  grant,
  consumer: "notes",
  event,                                  // the event as the page listed it
})
if (thread.ok) renderDetail(thread.answer) // the plugin's declared detail output
```

`probe` reads the signed-in account and the scopes the provider sign-in holds; it reads no content. Use it before a
`$me` param or to show which account an alias is:

```ts
import { probe } from "@we-the-rebel-alliance/plugin-contract/read"

const answer = await probe(host, { installed, source: "acme.messages", account: "work" })
if (answer.ok) showOwner(answer.answer.owner) // { id, label, verified?, orgs? }, and scopes
```

A probe is fenced by the plugin's declared `methods.probe` action, `<name>.probe`, and the provider operations in
`methods.probe.operations`. The caller supplies neither, and `answer.owner.id` is the signed-in id a `$me` param
resolves to.

### Reads through a broker

An app with a host broker passes a transport to `sourceReader`. It builds the one `BrokerRequest` for you and checks a
brokered answer exactly as an embedded read does:

```ts
import { sourceReader } from "@we-the-rebel-alliance/plugin-contract/catalog"

const reader = sourceReader({ host, broker: (request, signal) => app.callBroker(request, signal) })
const outcome = await reader.read(request)
outcome.via // "broker" or "embedded"; outcome.cached is true when the broker served its cache

if (!outcome.ok) show(outcome.failure) // a broker refusal is final: no embedded read behind it
```

`brokerRequest(read)` is the wire shape, if the app sends it itself. It carries `consumer`, the source's `package`,
`version` and `manifestHash`, the `source`, `account`, `scope`, and the events fields or `pick`. It never carries the
manifest or the grant. The consumer is the grant key and the broker's audit line. A broker that says
`{ offered: false }`, throws or answers something that is not a broker answer makes the client read embedded; a refusal
from a broker is passed through the error table and is not retried elsewhere.

## 3. Subscribe to nudges

A plugin emits `changed`, `status` and `account` as `rpc.<name>.<event>` on `/api/event`. A nudge says "look again"; it
never carries the content. Pass each payload to the reader, naming the plugin:

```ts
import { busEventType, readBusEvent } from "@we-the-rebel-alliance/plugin-contract/bus"

const filter = busEventType("acme", "changed") // "rpc.acme.changed"

for await (const payload of app.events()) {
  if (payload.type !== filter) continue
  const decoded = readBusEvent(payload, { name: "acme" })
  if (!decoded.ok) continue                     // not-a-bus-event, unknown-plugin, unknown-event, secret, invalid
  if (decoded.event.event === "changed") {
    await requestRead(decoded.event.data.capability, decoded.event.data.account)
  }
}
```

A decoded event is `{ type, name, event, data }`. `changed` carries `{ capability, account, reason }`, `status` carries
`{ state }`, and `account` carries `{ account, state }`. The reader screens the data for secrets before it validates it,
so a credential is `secret`, never `invalid`; the result then carries no part of the payload. `readBusEvent` throws only
for a bad `options.name`; a payload never throws.

The plugin side is `busEvents(name)`: `register` places it on its one RPC registration and builds the typed writer from
it, which is `registration.bus` and every handler's `call.bus`. An app never calls `busEvents`; it filters with
`busEventType` and decodes with `readBusEvent`.

## 4. Act: preview, then commit

A write is an action with a `preview` and a `commit`. The preview calls the action's `plans: true` method and writes
nothing; its answer carries the confirm fields and the plan id the commit spends. The person confirms; the commit calls
the action's `commits` method with exactly `{ planId }` and the host-signed action grant for that commit.

```ts
import { randomUUID } from "node:crypto"
import { act } from "@we-the-rebel-alliance/plugin-contract/act"
import { signGrant } from "@we-the-rebel-alliance/plugin-contract/grant"

const preview = await act(host, {
  installed,
  action: "acme.messages.send",
  grant: actGrant,                        // { consumer, action, account, manifestHash }
  consumer: "notes",
  phase: "preview",
  input: { text: "Deploy finished" },
})
if (!preview.ok) throw new Error(preview.failure.message)

showConfirm(preview.preview)              // output, reaches?, changes?, cost?, method
const planId = preview.preview.planId     // minted by the plugin's register: 128 random bits, never chosen by a handler

// The person confirms. The host signs one action grant for the commit method and exactly { planId }.
const now = Math.floor(Date.now() / 1000)
const grantToken = signGrant({
  key: hostPrivateKey,
  kid: "host_2026_11",
  audience: installed.package,
  consumer: "notes",
  capability: "acme.send_message",        // the act's commit method, not its preview method
  account: actGrant.account,
  scope: {},                              // the whole commit method
  act: "acme.messages.send",
  input: { planId },                      // the exact input the commit will run with
  manifest: installed.hash,
  iat: now,
  exp: now + 60,
  jti: randomUUID(),                      // one use; the plugin's store records it
  cfm: true,                              // the person confirmed; register requires it on a non-read grant
})

const commit = await act(host, {
  installed,
  action: "acme.messages.send",
  grant: actGrant,
  consumer: "notes",
  phase: "commit",
  planId,                                 // the plan the preview answered
  grantToken,                             // the grant the plugin's register verifies
})
if (commit.ok) showResult(commit.result.output)
```

**The preview.** `act` checks the action, the grant (consumer, act, account, manifest hash), and the input against the
act's input schema, then calls the preview method in the preview fence: deny everything, allow that method and its
declared operations for the granted account. The answer carries `trust: "untrusted"`, the act's `output`, the optional
one-confirm fields and the plan: `planId` and the `method` that commits it. The `planId` is minted by the plugin's
`register` from 16 random bytes (128 bits) and kept in the plugin's plan store; the handler never chooses it, so a
person's confirmation binds to a value nobody can guess.

**The confirmation.** The person sees `output`, `reaches`, `changes`, `cost` and the account. The host signs the grant
with `signGrant` for the action's commit method, the act id, the granted account, the installed manifest's hash and the
exact `{ planId }`, with `cfm: true` when the person confirmed the act. Contract §8 requires the confirmation for a
non-`local` effect; the plugin's `register` requires it on every non-read grant it verifies. The grant is short-lived
and single-use; the plugin's `register` records its `jti` in a durable store.

**The commit.** `act` takes `planId` and `grantToken` — no input, and no `confirmation`. It calls the action's
`commits` method with exactly `{ planId }`, carrying grant and consumer in the RPC envelope
(`{ sessionID, input: { planId }, grant, consumer }`), in the **commit fence**: deny everything, then allow the commit
method and its declared operations for the granted account. A handler's inner call outside that grant is denied, as is
the preview method. The plugin's `register` reserves the plan first, then verifies the grant, then runs the handler once
with the plan handler's copied full answer as `call.plan`.

**One plan, once.** A plan expires after 15 minutes and commits once. A second commit is `PLAN_USED`; a replayed grant is
`GRANT_INVALID`; an unknown or expired `planId` is `PLAN_INVALID`; a commit through another method is `PLAN_INVALID`. A
refusal before the handler runs releases the plan; the handler's start consumes it, so a failed handler still used the
plan. A `planId` from before a plugin reload is unknown to the new instance.

The commit's answer is checked like a preview's: `trust`, its size, `output` against the act's output schema, and its
account.

## 5. A write from an app UI with no agent

Some apps have no session to ask in. The person confirms in the app's own UI, the app's host signs the action grant for
the commit, as §4 showed, and the plugin's `register` verifies it. The grant binds the plugin's package as `aud`, one
consumer, one capability (the action's commit method), one account, one scope, one act, the digest of exactly
`{ planId }`, one manifest hash and a short lifetime, and it is single-use.

**The plugin wires the verifier.** A plugin holds public keys and a durable store; it never holds the private key and
never calls `verifyGrant` itself. It passes the wiring to `register` as its fourth argument; when a non-read call carries
a grant, the register verifies it:

```ts
import { register } from "@we-the-rebel-alliance/plugin-contract/register"

const registration = await register(ctx, manifest, handlers, {
  grant: {
    keys: { keys: { host_2026_11: hostPublicKeyPem }, revoked: [] },
    audience: "@we-the-rebel-alliance/acme-plugin",
    store: { consume: (claims) => storage.claim(claims.jti) },  // insert-if-absent, durable, atomic
  },
})
```

The register checks the token's shape, the trusted key (never "try every key"), the signature, every binding, the
lifetime, the input digest, the confirmation and finally the store. A failure before the store writes nothing. The store
must be durable and atomic: an in-memory map would resurrect a spent grant after a restart. `grant` does no I/O and
reads no clock; the register passes the time.

Every non-read method needs one of contract §8's two confirmations: a grant from an app, as here, or an answered
permission ask in an agent session. An `allow` rule alone is not a confirmation: the register refuses a non-read RPC
call with `PERMISSION_DENIED` and names both ways (LD-5). A commit's grant must name the plan's account, or it is
`ACCOUNT_MISMATCH`.

`consumer` is the grant key everywhere: the app's identity in a grant, a broker request and an audit line. Do not reuse
another app's consumer string, and do not issue a grant for one consumer to another.

## 6. The access levels

`options.access` is the person's ceiling; the plugin's `methods` only narrow it. `read` means class `read`; every other
class is a change.

| Level | `read` | any other class |
|---|---|---|
| `all` (default) | runs | runs |
| `ask-changes` | runs | asks first |
| `read-only` | runs | off |

A method's `effect` may ask or deny where the level would allow; there is no `allow`, so a method can never widen the
level. A person's choice for one tool wins. The plugin installs the rules into every agent; an agent that appears later
is reported as unguarded and is never patched behind the person's back.

A read or act also needs the grant's fence to allow it: `read` compiles the grant to a session that denies everything,
then allows that source's method and its operations for the granted account. `act` does the same for one phase at a
time: the preview fence allows only the preview method, and the commit fence only the commit method, so a handler cannot
reach outside the granted phase. A `read-only` plugin refuses a non-read RPC call even with a grant; `ask-changes` and
`all` need the ask or the grant. Write and export methods are therefore available over RPC, under a confirmation (LD-5).

## 7. Show an auditor what each plugin can read and do

An auditor asks what each connector can reach in a person's accounts, and who granted it. The `audit` module builds
that answer from the same catalog listing and grant records the app already holds. The result is a plain value, so an
app may render it or export it as JSON.

```ts
import { auditReport, renderAuditReport, AUDIT_SCHEMA } from "@we-the-rebel-alliance/plugin-contract/audit"

const listing = await listInstalledPlugins(ctx)
const report = auditReport({
  person: "ana@example.com",
  plugins: listing.plugins,               // CatalogPlugin[], or InstalledManifest[]
  access: {                               // each plugin's options.access, by plugin name; defaults to all
    harbour: "read-only",
    trellis: "ask-changes",
  },
  grants: [
    { ...readGrant, person: "ana@example.com", grantedAt: "2026-11-20T10:00:00.000Z" },
    { ...actGrant, person: "ana@example.com", grantedAt: "2026-11-20T10:05:00.000Z" },
  ],
})

const markdown = renderAuditReport(report) // deterministic Markdown for the auditor

// Or export the JSON and check it against the published schema.
const exported = JSON.stringify(report, null, 2) // dist/schemas/audit.json is the same shape
const checked = AUDIT_SCHEMA.check(JSON.parse(exported))
if (!checked.ok) throw new Error(checked.problems.join("\n"))
```

The report names every installed plugin with its package, version, manifest hash and access level. It lists every
declared source and action with the grants behind it, and every method with its class and what the access level gives
it: `runs`, `asks first` or `off`. A grant carries its consumer, account, canonical scope, manifest hash, `disabled` and
`stale` marks, the person who gave it and the time they gave it. `stale` is true when the grant's manifest hash is not
the installed manifest's hash, so the person must consent again.

A grant whose plugin, source or action is not installed is listed under `problems`, with its reason and the whole
grant. It is never dropped and never thrown. The report carries no credential, token or provider value: an auditor sees
the declarations and the grant bindings, not the account's secrets.

## 8. Errors

Every failure reads `CODE: What happened. Next step: What to do.` The one table is `ERROR_CODES` in `events`:

`NEEDS_SIGN_IN`, `SCOPE_MISSING`, `ACCOUNT_REQUIRED`, `ACCOUNT_UNKNOWN`, `ACCOUNT_MISMATCH`, `CURSOR_INVALID`,
`CURSOR_EXPIRED`, `RATE_LIMITED`, `BUDGET_EXCEEDED`, `SOURCE_DISABLED`, `TOO_LARGE`, `INPUT_INVALID`, `SOURCE_UNKNOWN`,
`SCHEMA_VIOLATION`, `PERMISSION_DENIED`, `PLAN_INVALID`, `PLAN_USED`, `GRANT_INVALID`, `HOST_UNTESTED`, `OPTIONS_INVALID`,
`UNAVAILABLE`.

| Code | What the app does |
|---|---|
| `NEEDS_SIGN_IN` | show the account to sign in; do not retry until it is signed in |
| `SCOPE_MISSING` | the call needs a scope the person has not confirmed; ask for that scope and retry, never widen the grant yourself |
| `ACCOUNT_REQUIRED` | ask which alias, from the next step's list |
| `ACCOUNT_UNKNOWN` | ask again; the alias is not one the plugin has |
| `ACCOUNT_MISMATCH` | the answer or event is another account's; show the granted account |
| `CURSOR_INVALID`, `CURSOR_EXPIRED` | restart that source from a fresh window; render a `gap` when one is reported |
| `RATE_LIMITED` | wait `retryAfterSec` when present; do not spin |
| `BUDGET_EXCEEDED` | show the budget; a person must widen it |
| `SOURCE_DISABLED` | the person turned this source or action off; show the toggle, not an error state |
| `TOO_LARGE` | read a smaller window or fewer items |
| `INPUT_INVALID`, `SCHEMA_VIOLATION` | a caller bug or a plugin bug; check the manifest and report the latter |
| `SOURCE_UNKNOWN` | the plugin itself reported no such source; check the source id against the installed manifest (`read` reports an undeclared source as `UNAVAILABLE`) |
| `PERMISSION_DENIED` | the grant, consumer, scope, manifest hash or access level does not cover it; ask the person, do not widen it yourself |
| `PLAN_INVALID` | the plan expired, is unknown, or does not belong to the commit method; preview again |
| `PLAN_USED` | the plan was already committed; preview again, because a plan commits once |
| `GRANT_INVALID` | the action grant did not verify; confirm again. The precise `GRANT_CODES` value is for logs |
| `HOST_UNTESTED` | the plugin refused an OpenCode release outside its range; update or pin |
| `OPTIONS_INVALID` | the plugin's options cannot be read; fix the configuration |
| `UNAVAILABLE` | the installed manifest declares no such source, act or method, the host cannot read the plugin's status, or the table does not hold the plugin's own code; read the message and next step |

A plugin may show a code of its own in `status.nextStep`. Its manifest declares each one in `errors`, with the `status`
surface and a meaning, so an app reads the installed manifest to explain it. It is never a failure of a read or an act.

A `ReadFailure` carries `{ code, message, next, retryAfterSec? }`. A plugin's own refusal, as a `SourceError` or an error
in the table's form, is read with `parseSourceError`; a code the table does not hold is `UNAVAILABLE`. An undeclared
source or act is `UNAVAILABLE` from `read` and `act`; a plugin's own `SOURCE_UNKNOWN` passes through as itself. Treat an
unknown code as `UNAVAILABLE`, never as success.

## What the app owns

| The app keeps | Why |
|---|---|
| the consent screen and the grant | consent is the unit of trust; a changed manifest hash asks again |
| its cursors | `read` is stateless; `failed[]` says when to hold the cursor back |
| its cache and budgets | the plugin reports cost; the app enforces its own budget |
| placement and rendering | plugins never render; shapes and events are data |
| its consumer key | it is the grant key, the broker's audit line and the scope of everything the app may read |
