# plugin-contract

The contract between OpenCode plugins and the apps that use them. A plugin declares once what it reads, what it does and
how risky each call is; any app can then use it, and no app is named. This package holds the language and the library:
the manifest schema, the event and page model, the error table, the modules that read and act under a grant, the
conformance kit and the `plugin-kit` binary.

It is greenfield at `v0.0.0`. There are no compatibility shims and no legacy aliases.

## What a plugin declares

One top-level `capabilities` key in the plugin's `package.json`: identity and the OpenCode range, how accounts work, the
options' JSON Schema, every method with its class and provider operations, the sources an app may bind to, the actions a
person may take, and the bus events the plugin emits. The manifest is read from the installed package on disk, never over
RPC, and hashed; a grant stores the hash, so a changed manifest asks the person again. Contract §4 is the full shape.

An app-only hint is allowed only as an `x-<app>` key, which every other app ignores and no app may require.

## The five doors

Every method is written once and reached through every door (contract §9):

| # | Door | Who | Mechanism |
|---|---|---|---|
| 1 | Agent tool | agents | `ctx.tool`, namespace `<name>`, permission `<name>.<method>` |
| 2 | Code Mode and automations | scripts, automations | `tools.<name>.<method>(…)` |
| 3 | RPC | apps, scripts, the catalog | `POST /api/rpc/<name>/<method>` with `{ sessionID, input }`, under that session's rules |
| 4 | Bus | apps | `rpc.<name>.<event>` on `/api/event` |
| 5 | MCP Events | event automations | an optional `mcp-events` adapter, one local server per plugin |

`register(ctx, manifest, handlers)` wires doors 1–3 from one handler table. A plugin writes no door code. Bus nudges
carry no content: an app re-reads through door 3.

## Install

Each release is a GitHub tag with `dist/`, `SHA256SUMS`, the conformance kit as one file and the JSON Schema bundle. Pin
the exact release tag. The first release is `v0.0.0`, cut in roadmap 1.16; until that tag exists, pin the commit under
test.

```sh
npm install github:we-the-rebel-alliance/plugin-contract#v0.0.0
```

The package has no runtime dependencies: `dist/` imports only Node built-ins, and a plugin bundles what it imports into
its own `dist/`. Node 22 or later runs the package; the conformance host needs Node 24 or Bun, and T1 reports
`T1.host-unavailable` elsewhere. CI checks Node 24 and Node 22.

## Modules

Each module is its own entry point: `import { read } from "@we-the-rebel-alliance/plugin-contract/read"`. A plugin
bundles only what it imports.

| Module | Side | Does | Docs |
|---|---|---|---|
| `.` (root) | both | the contract wire version and the plain validator types | [plugin-contract](docs/plugin-contract.md) |
| `manifest` | both | `capabilities`: schema, validation, lookups and hashing | [manifest](docs/manifest.md) |
| `accounts` | plugin | profiles, names, registration, `account` resolution, status | [accounts](docs/accounts.md) |
| `access` | plugin | the three access levels as permission rules, and the fences a grant compiles to | [access](docs/access.md) |
| `register` | plugin | doors 1–3 from one handler table, with input, account, permission and output checks | [register](docs/register.md) |
| `events` | plugin | the event and page model, normaliser, hash, secret screening and the error table | [events](docs/events.md) |
| `cursor` | plugin | the opaque cursor, bound to plugin, source, account and scope | [cursor](docs/cursor.md) |
| `bus` | plugin | typed `changed`, `status` and `account` nudges, and the reader that decodes them | [bus](docs/bus.md) |
| `grant` | plugin | the host-signed, single-use action grant: signer, verifier and codes | [grant](docs/grant.md) |
| `outputs` | both | the snapshot shape registry and its JSON Schemas | [outputs](docs/outputs.md) |
| `read` | app | fenced reads, detail reads and `probe`, through the catalog or embedded | [read](docs/read.md) |
| `act` | app | preview then commit of a register-minted plan under a host-signed action grant | [act](docs/act.md) |
| `audit` | app | what each installed plugin may read and do for a person, with the grant behind it, and its Markdown report | [audit](docs/audit.md) |
| `params` | app | relative times, windows and `$me`, resolved at read time | [params](docs/params.md) |
| `pick` | app | field selection, checked against the output's schema | [pick](docs/pick.md) |
| `catalog` | app, catalog | installed manifests, the broker request and the consumer's reader | [catalog](docs/catalog.md) |
| `hints` | plugin | the generic hint file: frontmatter, limits and checks | [hints](docs/hints.md) |
| `schemas` | both | every published JSON Schema, by name | [schemas](docs/schemas.md) |
| `conformance` | CI | T0, T1 and every recorded check, as one report | [conformance](docs/conformance.md) |
| `kit` | dev | the `plugin-kit` binary and the shared OpenCode 2.4 host harness | [kit](docs/kit.md) |

The [contract](docs/contract.md) is the authority; [how an app uses the contract](docs/consumers.md) is the app's
end-to-end guide; the event and cursor model is in [events](docs/events.md) and [cursor](docs/cursor.md).

## For plugin authors: `plugin-kit`

`plugin-kit` ships inside this package as a binary and a dev export. A plugin adds the package as a `devDependency` and
runs the binary from `node_modules/.bin/plugin-kit`; it never bundles the kit into its own `dist/`. Every command runs
from the plugin's root, or with `--dir <path>`; `--json` prints one JSON object; a command exits `0` when it passes, `1`
when a finding is an error, and `2` for a usage mistake.

| Command | Does |
|---|---|
| `npx plugin-kit check` | everything a pull request needs: the conformance report, the doc file set, forbidden patterns, no bundled kit |
| `npx plugin-kit docs --check` | every generated doc section matches the manifest |
| `npx plugin-kit record --account work` | the record pass, then redact `fixtures/conformance.json` |
| `npx plugin-kit conformance --host 2.4.1` | the whole report; `--record` while a fixture is being written |
| `npx plugin-kit hosts` | the OpenCode release matrix: `[2.4.1]` |
| `npx plugin-kit release 0.0.0 --dry-run` | the release guard and the tag plan; the owner pushes the tag |
| `npx plugin-kit supported --wave A --status planned` | this plugin's `SUPPORTED.md` row |
| `npx plugin-kit forbidden` | app identifiers, `main`-branch links and secrets |

[docs/kit.md](docs/kit.md) describes each command, the generated sections, the fixture redaction, the release guards and
the host harness. A new plugin starts from `plugin-template`.

## Docs

[docs/index.md](docs/index.md) lists every page. Start with:

- [The contract, v0](docs/contract.md): the manifest, accounts, methods and access, sources, actions, doors, bus events,
  status, errors, trust, catalog, modules, conformance and versions.
- [The plugin standard](docs/plugin-standard.md): what every `<name>-plugin` repository must be.
- [How an app uses the contract](docs/consumers.md): discover, read, subscribe, act, the grant flow and the errors.
- [Decisions](docs/decisions.md): the settled decisions behind v0.
- [Supported plugins](SUPPORTED.md): the plugins and their state.
- [AGENTS.template.md](AGENTS.template.md): the agent guide every plugin starts from.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to build and check this package.

## Licence

MIT. See [LICENSE](LICENSE). `dist/` bundles zod (MIT); see [dist/THIRD-PARTY-NOTICES.md](dist/THIRD-PARTY-NOTICES.md).
