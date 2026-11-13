# The contract, version 1 (L0 to L2)

The source contract has three layers: the data model (L0), the descriptor a plugin declares (L1) and the protocol it implements (L2). Each project builds its own features on top; nothing here needs a host. The design and its decisions: [app#2346](https://github.com/we-the-rebel-alliance/app/issues/2346#issuecomment-6853030617).

**Three roles.** A **plugin** owns its sources: the declaration, the reads, the provider sign-in, truthful cost and conformance in its own CI. The **contract** (this package) owns the language. A **project** (Memory, Artifacts, jelly and any after them) owns its features, consent, cache, budgets and cursors, built from the library. No project restates a plugin's sources, calls a provider directly or depends on another project.

**Reads only.** Writes stay where they are: plan, then commit in the plugin, with the project's own confirmation.

## L0: the data model

Every result is marked `trust: "untrusted"`: its text is data, never instructions. An owner is `{ id, label? }`, where `id` is scheme-qualified (`mailto:`, `slack:`).

### Events

An **event** is one thing a source recorded: `source`, `account`, `external_id` (at most 512 characters, stable within the source and account), `kind`, `occurred_at` (UTC ISO 8601), `thread` (a stable key or null; first-class), `actors` (at most 20, each `{ role, id, name? }`), `title` (at most 300), `text` (at most 4096), `url` (https or null), `labels` (at most 20) and `hash` (`sha256:` of every other field).

**Kinds:** `message`, `meeting`, `session`, `bookmark`, `issue`, `pr`, `commit`, `doc`, `event`, `task`, `file`, and `x-<plugin>/<kind>` for a plugin's own.

**A page** of `events_list`:

| Field | Means |
|---|---|
| `source`, `account`, `owner` | whose page it is, on an empty page too |
| `events` | oldest first |
| `cursor`, `more` | where the next call starts; `more: false` is not "done", since a later call may list new events |
| `refused[]` | final drops with a reason: instruction-shaped text from someone else, a secret, the wrong owner. The consumer may advance past them. |
| `failed[]` | retryable drops. Any entry holds the cursor back. |
| `gap` | `{ reason: "expired" \| "window-truncated", since }` when history is lost |
| `cost` | what the provider reported, for a billed source |

**A cursor** is opaque and versioned, bound to the plugin, source, account and scope. A foreign cursor is refused with `CURSOR_INVALID`; lost history is `CURSOR_EXPIRED` with `gap`. A consumer saves its cursor in the same transaction as the page it accepts.

The `events` and `cursor` modules hold the normaliser, the hash, the secret-pattern refusal and the codec (the plugin family's part).

### Snapshots

A **snapshot** is the latest state of something, read on demand: `{ data, asOf, cost?, trust }`, with `data` valid against the source's declared `output`.

**The output registry** (`registry`) holds the shapes, so a project that renders a shape renders every source that outputs it: `agenda` (gws `calendar.today`'s shape), `inbox`, `metric`, `list`, `progress`, `note`, `links`, `countdown`, `image`, `thread`, `table` and `record`, seeded from jelly's Home templates. Each is published as JSON Schema in `dist/schemas/output.<name>.json`. A name is never removed or narrowed within a contract version.

### Errors

One table, in the family's form: `CODE: what happened. Next step: …`.

| Code | Means |
|---|---|
| `NEEDS_SIGN_IN` | the provider needs a sign-in (`AUTH_REQUIRED` is the same) |
| `SCOPE_MISSING` | the sign-in lacks a scope the read needs; reconnect with it |
| `ACCOUNT_MISMATCH` | the source is signed in to another account than the grant's |
| `CURSOR_INVALID` | the cursor is not this source's, account's and scope's |
| `CURSOR_EXPIRED` | history is gone; the answer carries `gap` |
| `RATE_LIMITED` | the provider's limit; with `retryAfterSec` |
| `BUDGET_EXCEEDED` | the person's own budget is spent; not the provider's limit |
| `SOURCE_DISABLED` | the person turned the source off; not an error state |
| `TOO_LARGE` | the answer is over the source's `maxBytes` |
| `SCHEMA_VIOLATION` | an input or an answer breaks the contract |
| `PERMISSION_DENIED` | a session rule refused the read |
| `UNAVAILABLE` | anything else; try again later |

## L1: the descriptor

One top-level `sources` key in the plugin's `package.json`, read from the **installed package on disk**, never over RPC: an RPC id has no owner in OpenCode, so `describe` and anything said over RPC are diagnostics only. It is host-neutral, not under any project's key; a project's own declaration refers to source ids.

```json
"sources": {
  "contractVersion": 1,
  "items": [
    {
      "id": "gws.gmail", "kind": "events", "reads": "message",
      "tool": "events_list", "input": { "source": "gmail" },
      "accounts": { "named": true },
      "scope": { "keys": ["labels"], "describe": "Which labels" },
      "details": [{ "id": "gws.gmail.message", "tool": "read", "from": ["external_id"] }],
      "permission": { "events": "gws.events_list",
        "operations": ["gmail.users.history.list", "gmail.users.messages.list", "gmail.users.messages.get"] },
      "private": true, "cost": { "class": "free" }, "maxBytes": 262144, "retentionDays": 30
    },
    {
      "id": "gws.calendar.today", "kind": "snapshot", "tool": "calendar_today",
      "output": "agenda", "params": { "window": { "relative": true } },
      "accounts": { "named": true },
      "permission": { "tool": "gws.calendar_today", "operations": ["calendar.events.list"] },
      "private": true, "cost": { "class": "free" }, "maxAgeSec": 900, "maxBytes": 65536
    }
  ]
}
```

The rules:

- every tool a source names is a read (`readOnly`, class `read`);
- `permission.operations` is **required**: grants and a person's off switches key on it. A dotted operation (`gmail.users.messages.get`) is asserted as `<namespace>.read` on `<account>:<operation>`, and a bare one, an MCP tool (`slack_read_channel`), as `<namespace>_<operation>` on `*`; the namespace is the source id's first segment, and every action of the source begins with it;
- `scope.keys` are what a person confirms (labels, channels, repositories);
- each `details` entry names the event fields its input is (`external_id`, `thread` and the other identifiers), never `title` or `text`; it is called with `{ account, scope, fields }` under the source's own rules, and the plugin refuses an event outside the confirmed scope;
- `private: true` is shown at consent;
- `cost` states price units, including `probe`'s; a billed source must state them;
- `cadence.providerMinMinutes` only where the provider imposes a minimum;
- `maxBytes` defaults to 64 KB and may go up to 1 MB;
- a snapshot's `output` names a registered schema;
- optional `urlHosts`: the hosts a source's `url` may point at, for display (Memory's rules);
- optional `scope.suggest`: `{ tool, operations }`, a read-only tool that lists choices at consent, run only at bind in its own session, and never stored.

`readInstalledDescriptor` reads, validates and hashes it (`sha256:` of canonical JSON). A grant stores the hash; a changed descriptor asks the person again. Three optional keys are agreed in [issue #4](https://github.com/we-the-rebel-alliance/source-contract/issues/4) and wait for Memory's schema to admit them: `sources.rpc` (the plugin's tools-RPC id, which `read` then calls), `sources.probe.action` (the probe tool's permission action) and per-source `permission.identity` (the identity operations `probe` asserts). With the last two declared, `probe` is fenced from the descriptor alone; until then a consumer passes the identity operations.

## L2: the protocol

| Method | In | Out |
|---|---|---|
| `events_list` | `source, account?, scope?, cursor?, since?, limit?` | the page |
| `snapshot_read` (the source's `tool`) | `source, account?, params?` | the snapshot |
| `probe` | `source?, account?` | the owner and the granted scopes; reads no content |
| `describe` | none | the descriptor, for diagnostics only |

**Params are resolved by the library at read time** (`params`), so a plugin receives plain values:

- relative times: `"now"`, `"-90m"`, `"+2h"`, `"-7d"`, `"+1w"`, in the person's time zone, rounded down to the minute, at most 366 days either way;
- windows: `"today"`, `"yesterday"`, `"tomorrow"` (midnight to midnight where the person is), or `{ since, until }`;
- `$me`: the signed-in account, as `probe` names its owner, where the param declares `me: true`.

**Every read can carry `pick`** (`pick`): paths such as `items[].title`, checked against the output schema when the binding is made. Only those paths are returned, and a missing optional key is left out, not an error.

## The trust rule

The descriptor comes from the installed package, its version checked against the install, and **every read runs in a session limited to exact allow rules from the grant** (`permission.sessionRules`): a deny of everything, then the method's action and each operation's rule. OpenCode checks each inner tool call against the calling session's rules, and the last matching rule wins, so the session is a real sandbox whatever the agent allows. A broker or a project may only narrow these rules, and the plugin's own `access` setting stays final.

`read` refuses before any call when the grant is another consumer's, the source is off, the descriptor changed since consent or the scope is wider than granted; it then checks the answer's account, its `trust` marker, its size and, for a snapshot, its output. Grants are per consumer, source, account and scope. A cached answer serves only a consumer whose own grant covers the same source, account and scope, never another person or viewer.

## Versions

Semver. `sources.contractVersion` is the contract version; projects read the current and the previous one. Within a version the contract only grows.
