# The contract, v0

The contract between OpenCode plugins and the apps that use them. It replaces `source-contract` v0.3 and is greenfield:
no compatibility with v0.x of `source-contract`, no legacy aliases, nothing deprecated.

- **Repository:** `we-the-rebel-alliance/plugin-contract` (renamed from `source-contract`; history kept; default branch `master`).
- **Package:** `@we-the-rebel-alliance/plugin-contract`, released as GitHub tags from `v0.0.0`, each with `dist/`, `SHA256SUMS`,
  the conformance kit and the JSON Schema bundle. Plugins pin an exact tag and bundle the runtime modules they import.
- **Runtime:** OpenCode `>=2.4.1`. The contract builds only what OpenCode lacks (§2).

## 1. Principles

1. **Capability, runtime and experience have separate owners.** The plugin owns what a provider can do. OpenCode owns
   identity, permission, execution, scheduling, transport and notification. Each app owns placement, rendering, consent screens,
   cadence, budgets, caches and cursors. The contract is only the language between plugin and app.
2. **Declare meaning, never placement.** A manifest says what a plugin reads and does, how risky each call is, and which accounts it serves.
   It never names an app. An app-only hint is allowed only as an `x-<app>` key, which every other app ignores and no
   app may require.
3. **One implementation, five doors.** Every method is written once and is reachable through every door (§9).
4. **Consent is the unit of trust; OpenCode enforces it.** A grant compiles to OpenCode session rules. The plugin's
   `access` option is the ceiling. Hosts and brokers may only narrow.
5. **Pull is the truth; push is a nudge.** Cursors and snapshots carry correctness. Bus events, MCP Events and webhooks only
   make things faster.
6. **Many accounts, always.** Every plugin that signs in to a provider supports several named accounts at once (§5).
7. **One name everywhere.** A plugin's `<name>` is its repository, package, namespace, ids, servers and events (§3).
8. **Proven in CI.** Every plugin passes the conformance kit with recorded fixtures before it releases.

## 2. Who owns what

| Concern | Owner | How |
|---|---|---|
| Provider calls, normalising, honest cost, conformance | Plugin | contract library |
| Manifest, data model, outputs, errors, grants, access semantics, accounts model, conformance | Contract | this package |
| Sign-in and credentials | OpenCode | `ctx.integration`; `/api/integration/*`; `Integration.Info.connections`, `credential.switched` |
| Permission enforcement, sessions, risky-call asks, forms | OpenCode | permission rules; `ctx.permission.assert`; `/api/session/{id}/permission/*`, `/api/session/{id}/form/*` |
| Running a call | OpenCode | `ctx.tool` (namespace, permission, `codemode`) |
| Typed API for apps and scripts | OpenCode | `ctx.rpc.register` → `POST /api/rpc/{rpcID}/{method}` |
| Notifying apps | OpenCode | RPC events → `rpc.<rpcID>.<event>` on `/api/event` |
| Scheduling, push into agents | OpenCode | automations (`at`, `every`, `cron`; prompt, code, shell); MCP Events → event automations |
| Plugin state | OpenCode | `ctx.storage` |
| MCP servers, skills, commands | OpenCode | `ctx.mcp.transform`, `ctx.skill`, `ctx.command` |
| OpenCode's own UI | OpenCode | GUI plugins (`Panel`, `SettingsPage`, `Command`, `Slot`) and TUI plugins; optional for a plugin |
| Placement, rendering, consent screens, cadence, cursors, caches, budgets | Each app | its own bindings, keyed by capability ids |

## 3. Names

A plugin has one `<name>`: lowercase letters and digits, 1–31 characters, no hyphen (a hyphen separates an account
alias). Everything derives from it. A one-letter name is valid: `x` is a plugin name, and `x-<app>` is a manifest
extension key; the two never share a namespace.

| Thing | Form | Example (`slack`, account `work`) |
|---|---|---|
| Repository | `we-the-rebel-alliance/<name>-plugin` | `slack-plugin` |
| Package | `@we-the-rebel-alliance/<name>-plugin` | |
| Install | `opencode plugin add github:we-the-rebel-alliance/<name>-plugin#vX.Y.Z` | |
| OpenCode plugin id | `<name>` | `slack` |
| Tool namespace (Code Mode) | `<name>` | `tools.slack.events_list` |
| RPC id | `<name>` | `/api/rpc/slack/events_list` |
| Permission action | `<name>.<method>` | `slack.events_list` |
| Permission resource | `<alias>:<operation>` | `work:conversations.history` |
| Capability id | `<name>.<capability>` | `slack.mentions` |
| Integration (plugin-held credentials) | `<name>` for `default`; `<name>-<alias>` | `gws-work` |
| MCP server (vendor OAuth) | `<name>` for `default`; `<name>-<alias>` | `slack-work` |
| MCP tool permission | `<server>_<tool>` | `slack-work_slack_send_message` |
| Bus events | `rpc.<name>.<event>` | `rpc.slack.changed` |
| Skills | `<name>` or `<name>-<topic>` | `slack-search` |
| Status command | `/<name>` | `/slack` |

## 4. The manifest

One top-level `capabilities` key in the plugin's `package.json`. It is read **from the installed package on disk**,
validated strictly, and hashed (`sha256:` of canonical JSON). A grant stores the hash, so a changed manifest asks the person
again. Nothing said over RPC is trusted as a manifest.

```json
"capabilities": {
  "version": 1,
  "plugin": {
    "name": "gws",
    "title": "Google Workspace",
    "summary": "Gmail, Calendar, Drive, Docs and Sheets.",
    "vendor": { "id": "google", "name": "Google", "domain": "google.com" },
    "icons": [{ "src": "assets/icon.svg", "type": "image/svg+xml" }],
    "host": { "opencode": ">=2.4.1 <2.5.0", "tested": ["2.4.1"] }
  },
  "accounts": {
    "via": "integration",
    "profile": { "$ref": "#/options/properties/accounts/additionalProperties" },
    "owner": "mailto"
  },
  "options": { "type": "object", "properties": { "access": {}, "accounts": {}, "allowUntestedHost": {} } },
  "methods": {
    "status":      { "class": "read", "accounts": "none",
                     "description": "Read the plugin's state and its accounts.",
                     "input": { "type": "object", "properties": {}, "additionalProperties": false } },
    "probe":       { "class": "read", "accounts": "optional", "operations": ["gmail.users.getProfile"] },
    "events_list": { "class": "read", "accounts": "optional" },
    "plan":        { "class": "read", "plans": true, "accounts": "optional" },
    "send":        { "class": "send", "commits": "plan", "accounts": "optional" },
    "mcp:*":       { "class": "read" }
  },
  "sources": [
    {
      "id": "gws.gmail", "kind": "events", "reads": "message", "method": "events_list", "input": { "source": "gmail" },
      "service": { "id": "gws.gmail", "label": "Gmail" },
      "operations": ["gmail.users.history.list", "gmail.users.messages.get"],
      "cadence": { "suggestMinutes": 2 }, "signals": ["bus"],
      "private": true, "cost": { "class": "free" }, "maxBytes": 262144
    }
  ],
  "actions": [
    { "id": "gws.gmail.send", "effect": "notify", "preview": "plan", "commit": "send",
      "input": { "type": "object" }, "output": { "type": "object" } }
  ],
  "events": { "changed": {}, "status": {}, "account": {} }
}
```

| Key | Meaning |
|---|---|
| `version` | The manifest's wire version, `1`. Independent of the package's semver. |
| `plugin` | Identity, title, summary, vendor, icons, and the OpenCode range with its tested releases. Replaces the old `opencode` and app-specific keys. |
| `accounts` | How accounts work (§5). Absent: the plugin signs in to nothing. |
| `options` | JSON Schema of the plugin's options. Titles and descriptions double as form labels. Must include `access`; must include `accounts` when `accounts` is declared; may include `allowUntestedHost`. |
| `methods` | Every callable: contract methods, plugin tools and pass-through MCP tools (`mcp:<tool>` or `mcp:*`) (§6). |
| `sources` | Read capabilities an app can bind to (§7). |
| `actions` | Writes an app can offer a person (§8). |
| `events` | The bus events the plugin emits (§10). |
| `errors` | Optional. The plugin's own error codes, each `{ surface, meaning }` (§12). |
| `guestTools` | Optional. Tools a plugin's helper adds on another machine, such as the boxd guest's `done`: names T0 accepts in the plugin's text, never methods it registers (§16). |
| `x-<app>` | Optional app-only hints. Never required, never read by another app, never read by the conformance kit beyond its name. |

## 5. Accounts

Every plugin that signs in supports several named accounts at once, such as `work` and `personal`.

- **Alias:** `^[a-z][a-z0-9]{0,31}$`. The account with no alias is `default`.
- **Profiles:** option `accounts`, a map of alias to profile. The profile's schema is the plugin's (for example gws's
  `mode`, `enabledServices`; elevenlabs's `region`; github's `host`). With no `accounts` option, there is one `default`
  account.
- **Mechanism** (`accounts.via`):
  - `integration`: the plugin holds the credentials. One OpenCode integration per alias, `<name>` and `<name>-<alias>`,
    each signed in with `/connect` or `opencode auth login <name>-<alias>`.
  - `mcp`: the vendor's MCP server holds them. One MCP server per alias, `<name>` and `<name>-<alias>`, each with its
    own OAuth. OpenCode keys MCP OAuth per server.
  - `local`: the identity of the machine or OS user (`os-user:<user>@<host>`). One account.
- **Calls:** every method with `accounts: "optional"` takes `account`. With one account it may be left out. With more
  than one, leaving it out is `ACCOUNT_REQUIRED`, whose next step lists the aliases. An unknown alias is `ACCOUNT_UNKNOWN`.
- **Identity:** `probe({ account })` returns the account's `owner { id, label, verified?, orgs? }`. `orgs` lists at most 5
  scheme-qualified organizations (`domain:prosus.com`, `slack-team:T0123`).
- **Permissions:** resources are `<alias>:<operation>`; MCP tools are `<name>-<alias>_<tool>`. Default rules from
  `access` cover every alias with `<name>-*`.
- **Cursors** are bound to plugin, capability, account and scope.
- **Status** lists each alias with `state` (`ready`, `needs_sign_in`, `error`) and, once probed, its owner.
- **Library:** the `accounts` module parses and validates profiles, derives integration and server names, registers them
  (`ctx.integration` or `ctx.mcp.transform`), resolves `account` on each call, and reports status.

## 6. Methods and access

One table covers every callable, including pass-through MCP tools, so a consumer knows how risky each call is before the plugin runs.

| Field | Meaning |
|---|---|
| `class` | `read`, `write`, `send` (reaches someone), `share` (widens access), `delete`, `export` (leaves the provider), `admin` |
| `description` | the tool's description; on a register method it is the live agent tool's, and `mcp:*` cannot carry it |
| `input` | the tool's input, as JSON Schema 2020-12; on a register method it includes `account` and a commit's `{ planId }`, and `mcp:*` cannot carry it |
| `accounts` | `optional` (takes `account`), `none` |
| `operations` | the provider operations it may assert, for grants and session rules |
| `plans: true` | dry-runs a change; the register mints its `planId` and the method answers `{ method, … }`; a commit reserves it before confirmation, consumes it at handler start, and only that method may commit it |
| `commits: "<method>"` | takes only `{ planId }` from that planning method; a consumer refuses any other input |
| `effect` | optional narrowing of access: `ask` or `deny`; never `allow` |
| `pinned` | `true` for a method whose signature Code Mode sends on every turn. None by default; at most one per plugin, only when session data shows most of the plugin's sessions call it, within about 1,000 tokens |

`description` and `input` are optional. On a register method, conformance (`T1.methods`) checks they are the live tool's,
so an app can plan a call before the provider is connected. An `mcp:<tool>` row carries the plugin's own claim from the
vendor's tool definition, and T1 does not check it because the vendor's server owns the tool. `mcp:*` is a wildcard with
no one tool, so it carries neither field.

**Access** (option `access`), generated into every agent's rules with `ctx.agent.transform` by the `access` module:

| Level | `read` | any other class |
|---|---|---|
| `all` (default) | runs | runs |
| `ask-changes` | runs | asks first |
| `read-only` | runs | off |

An `effect` of `ask` makes a call ask even when it is `read`. `deny` turns it off. `effect` only narrows the `access`
setting: there is no `allow`, so a method can never widen the person's level. A choice the person makes for one tool
wins. An agent that lacks the generated rules is named in status,
never patched.

**A tools-only plugin over a vendor's MCP server** declares its pass-through tools here, `mcp:*` for the default and
`mcp:<tool>` for each tool that differs, and nothing else: `sources` and `actions` are empty. The vendor's server owns
the tools, the plugin has no handler for them (§9), and they take no `account` input, so there is no read for a source
to name and no preview and commit for an action to name. Such a plugin shows that a tool reaches someone or costs money
through its `class` (`send`, `write`) and an `effect` of `ask`, which the access rules enforce. An `mcp:<tool>` row may
also carry `description` and `input` from the vendor's tool definition as the plugin's own claim; `mcp:*` carries
neither. The kit warns (`methods.mcp-wildcard`) about an `mcp:<tool>` row only when it repeats `mcp:*` exactly, so a row
with its own class, `effect` or `operations` is kept and raises no warning (operations compared as a set).

## 7. Sources (reads)

| Field | Meaning |
|---|---|
| `id` | `<name>.<capability>` |
| `kind` | `events` (a feed with a cursor) or `snapshot` (latest state) |
| `reads` / `output` | events: an event kind; snapshot: an output shape from the registry |
| `method`, `input` | the method that reads it, and the fixed input that selects it |
| `service` | `{ id, label }`: what a person turns on and off (Gmail, not gws) |
| `operations` | provider operations, for grants |
| `scope` | `{ keys, describe, suggest? }`: what a person confirms (labels, channels, repositories) |
| `cadence` | `{ providerMinMinutes?, suggestMinutes? }` |
| `signals` | how it can nudge: `bus`, `mcp-events`, `webhook` |
| `private`, `cost`, `maxBytes` | shown at consent; billed sources state their units |
| `details`, `facts`, `hints` | follow-up reads, structured facts, reading hints for model-based consumers |

**Event:** `source`, `account`, `external_id`, `kind`, `occurred_at`, `thread`, `actors` (role, id, name, kind,
identities, self), `title` (300), `text` (4,096), `url`, `labels`, `thumbnail?` (#42), `reply_to`, `audience`, `domains`,
`sections`, `parts`, `facts`, `hash`. **Kinds:** `message`, `meeting`, `session`, `bookmark`, `issue`, `pr`, `commit`, `doc`,
`event`, `task`, `file`, `x-<name>/<kind>`.

**Page:** `source`, `account`, `owner`, `events` (oldest first), `cursor`, `more`, `refused[]`, `failed[]` (holds the
cursor), `gap`, `removals[]`, `cost`, `asOf`, `trust: "untrusted"`.

**Snapshot:** `{ data, asOf, cost?, trust }`, with `data` valid against a registry shape: `agenda`, `inbox`, `metric`,
`list`, `progress`, `note`, `links`, `countdown`, `image`, `thread`, `table`, `record`. Apps render shapes, never plugins.

## 8. Actions (writes)

| Field | Meaning |
|---|---|
| `id` | `<name>.<action>` |
| `effect` | `local`, `notify` (reaches someone), `spend` (costs money), `irreversible` |
| `preview`, `commit` | two different methods; the preview writes nothing |
| `input`, `output` | JSON Schema 2020-12 |

A preview is the action's `plans: true` method: it writes nothing and answers `{ method, output?, reaches?, changes?,
cost?, trust }`. The register mints the plan's `planId` with 128 random bits and adds it to the public answer
`{ planId, method, output?, … }`, so a person's consent binds to a value no handler and no caller can guess or choose;
the handler's full answer reaches the commit as `call.plan`, as a copy bounded to 64 KB of JSON. The preview carries
everything the commit will write in the fields the person sees; private plan data is only for what the preview cannot
show, and the commit must not trust a value the person could not review. That commit takes exactly `{ planId }` and runs
once per plan. **Confirmation** of a non-`local` commit:
- **In an agent session:** an OpenCode permission ask, which any client can answer.
- **From an app's UI, with no agent:** a host-signed, single-use action grant bound to the commit method and the exact
  `{ planId }` digest, carried in the commit's RPC envelope with the consumer it was issued to, and verified by the
  plugin's `register` (the `grant` module, #40). The module does no I/O and returns codes. Single use is recorded
  through a store interface that the plugin backs with durable storage; the plan itself commits once.

Over RPC (door 3), every non-`read` method runs only with one of these two confirmations; without one it is refused.
Write and export methods may therefore be RPC methods.

## 9. Doors

| # | Door | Who | Mechanism |
|---|---|---|---|
| 1 | Agent tool | agents | `ctx.tool`, namespace `<name>`, permission `<name>.<method>` |
| 2 | Code Mode and automations | scripts, automations | `tools.<name>.<method>(…)` |
| 3 | RPC | apps, scripts, the catalog | `POST /api/rpc/<name>/<method>` with `{ sessionID, input }`, run under that session's rules |
| 4 | Bus | apps | `rpc.<name>.<event>` on `/api/event` (§10) |
| 5 | MCP Events | event automations | optional `mcp-events` adapter: a local server per plugin, registered as `<name>-events` |

`register(ctx, manifest, handlers)` in the library wires doors 1–3 from one handler table. It checks input and output
against the manifest, resolves the account, asserts permissions on `<alias>:<operation>`, and maps errors. No plugin writes door code.

## 10. Bus events (nudges)

| Event | Data | When |
|---|---|---|
| `changed` | `{ capability, account, reason }` | the plugin knows a source changed: after its own write, or on a webhook |
| `status` | `{ state }` | the plugin's state changed |
| `account` | `{ account, state }` | an account signed in, out, or needs sign-in |

Nudges carry no content. An app re-reads through door 3.

## 11. Status and probe

- **`status`** (every plugin): `{ name, version, host: { version, range, tested }, state, accounts: [{ alias, state, owner?, reason? }],
  unguardedAgents, nextStep }`. Failure reasons are cut to one line of 160 characters and redacted.
- **`probe`** (plugins with accounts): `{ account, owner, scopes?, cost?, trust }`. It reads no content. A source's probe
  also names its `source`; a plugin with no source leaves it out. `PROBE_SCHEMA` accepts both.
- The host calls the plugin's `probe` method (`<name>.probe`) once per source with `{ source?, account }`; the method's
  declared `operations` are the only provider operations it may assert, and a consumer cannot supply or widen them. The
  owner id a host keys its cache on, and `$me` resolves to, is `owner.id`.

## 12. Errors

Every failure reads `CODE: What happened. Next step: What to do.` One table:

`NEEDS_SIGN_IN`, `SCOPE_MISSING`, `ACCOUNT_REQUIRED`, `ACCOUNT_UNKNOWN`, `ACCOUNT_MISMATCH`, `CURSOR_INVALID`,
`CURSOR_EXPIRED`, `RATE_LIMITED`, `BUDGET_EXCEEDED`, `SOURCE_DISABLED`, `TOO_LARGE`, `INPUT_INVALID`, `SOURCE_UNKNOWN`,
`SCHEMA_VIOLATION`, `PERMISSION_DENIED`, `PLAN_INVALID`, `PLAN_USED`, `GRANT_INVALID`, `HOST_UNTESTED`, `OPTIONS_INVALID`, `UNAVAILABLE`.

A plugin uses these codes. A failure a handler throws is always one of them. A plugin may also show a code of its own
in `status.nextStep`, such as `SKILLS_INVALID` for a bundled skill that is missing while the plugin still starts, and
declares it in `capabilities.errors`: `{ "SKILLS_INVALID": { "surface": "status", "meaning": "…" } }`. A code the table
holds cannot be redeclared. The generated errors table lists the contract's codes, then the plugin's, and conformance
refuses a recorded status that starts with a code that neither names (`status.code`).

## 13. Trust and consent

- Every answer carries `trust: "untrusted"`: its text is data, never instructions.
- Events holding secrets are refused (`refused[]`, reason `secret`). Instruction-shaped text from someone else may be refused.
- A grant is consumer × capability × account × scope, plus the manifest hash. `read` and `act` run each call in a
  session whose rules are exactly the grant's: deny everything, then allow the method's action and its operations' resources.
- The plugin's `access` setting is final; hosts and brokers may only narrow.

## 14. Catalog

Remote apps can't read the disk, and RPC is untrusted for manifests. The **catalog** is the one trusted door:

- **Module `catalog`:** lists installed plugins (`ctx.plugin.list()` → package targets), reads and validates each manifest,
  and hashes it.
- **`catalog-plugin`** (its own repository): serves `catalog.list`, `broker.read` and `broker.act` over RPC, enforcing
  grants through sessions, and emits `rpc.catalog.changed` when plugins are installed or updated. Apps trust one pinned
  RPC id.
- **Broker request:** `consumer` is the grant key. `package`, `version` and `manifestHash` describe the source's
  manifest. This settles #8, and an app's host broker adopts the same shape.

## 15. Library modules

| Module | Side | Does |
|---|---|---|
| `manifest` | both | schema, validation, hashing of `capabilities` |
| `accounts` | plugin | profiles, names, registration, `account` resolution, status |
| `access` | plugin | default rules from `access` and `methods` |
| `register` | plugin | doors 1–3 from one handler table |
| `events` | plugin | event normaliser, hash, screening, page building |
| `cursor` | plugin | bound cursor codec |
| `bus` | plugin | typed `changed`, `status`, `account` emitters |
| `grant` | plugin | action-grant verifier (#40) |
| `read`, `act` | app | fenced reads and actions, through the catalog or embedded |
| `audit` | app | what each installed plugin may read and do for a person, with the grant behind it, and its Markdown report |
| `params`, `pick` | app | relative times, `$me`, field selection |
| `outputs` | both | the snapshot shape registry and its JSON Schemas |
| `catalog` | app, catalog | installed manifests |
| `conformance` | CI | the kit (§16) |
| `kit` | dev | the `plugin-kit` binary: `check`, `docs`, `record`, `conformance`, `hosts`, `release`, `supported`, `forbidden`; a devDependency, never bundled |
| `mcp-events` | plugin | optional; MCP Events adapter over events sources (later) |

## 16. Conformance (`plugin-kit conformance`)

- The manifest validates; names follow §3; `plugin.host` matches the built bundle.
- Every method in `methods` is registered through doors 1 and 3, and every registered tool is in `methods`.
- A register method's declared `description` and `input` are the live tool's (`T1.methods`); an `mcp:<tool>` row's values are the plugin's own claim, and `mcp:*` carries neither.
- Method names fit their class: `delete_*` and `remove_*` are `delete`; `send_*` and `post_*` are `send`; `share_*` is `share`.
- `options` validates the plugin's defaults; `accounts` behaviour holds with two recorded aliases
  (`ACCOUNT_REQUIRED`, `ACCOUNT_UNKNOWN`), plus a per-account cursor that doesn't cross over only when the plugin
  declares an events source.
- Events pages: the existing checks (sizes, kinds, hash, one author, gap once, removals, failed holds the cursor, secrets refused).
- Snapshots validate against their output shape; previews write nothing (recorded); actions' preview and commit differ.
- A non-`read` method called over RPC (door 3) without a permission ask or a valid action grant is refused (§8).
- Every emitted bus event is declared; status and probe shapes validate.
- Generated docs (§ plugin standard) match the manifest.
- No top-level key other than the manifest's own, and no app-specific key outside `x-<app>`.
- **T0 (static), a hard gate on every pull request:** the namespace line is at most 400 characters; each skill
  description at most 300; no text names a tool that doesn't exist, except a name in `guestTools`; no pinned method
  without evidence.
- **T1 (host), a hard gate on every pull request:** the plugin loads on every supported host; its permissions hold; an
  unsupported host gets a clean refusal (`HOST_UNTESTED`).

## 17. Versions

- **Package:** semver from `v0.0.0`. While `0.x`, a minor release may break: plugins and apps pin exact tags and move together.
- **From `1.0.0`:** the manifest and pages only grow within wire version 1. Apps update their copy of the contract first; plugins then use the new fields.
- **Plugins** share the version line: each starts at `v0.0.0` in the new org.

## 18. From source-contract v0.3

| v0.3 | v0 of plugin-contract |
|---|---|
| `sources` key, `contractVersion` | `capabilities` key, `version: 1` |
| acts | `actions`, with `methods` carrying `plans` and `commits` (#44) |
| `opencode` and app-specific keys | `capabilities.plugin`, `options`, `methods`; app placement moves into each app |
| `tools-rpc` (`<plugin>.tools`) | `register`, RPC id `<name>` |
| `describe` | diagnostics only; the catalog serves manifests |
| `acceptV1`, `CONTRACT1_CODES`, `ERROR_ALIASES`, `BROKER_CODE_ALIASES`, `PROPOSED_CODES` | removed |
| `accounts.named`, `accounts.server` | `accounts.via`, profiles, one naming rule |
| App-named hints and routines | generic `hints` for any model-based consumer; routines belong to the consumer |
| `service` (PR #49), `orgs` (#44), `methods` (#44), thumbnail (#42), grant verifier (#40) | built in from v0.0.0 |
