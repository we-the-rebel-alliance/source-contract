# source-contract

One source contract for jelly, Memory, Artifacts and every plugin (D202; design: [we-the-rebel-alliance/app#2346](https://github.com/we-the-rebel-alliance/app/issues/2346#issuecomment-6853030617)).

**Plugins are the interface for every data flow.** A plugin declares its sources once, in a top-level `sources` key in its `package.json`, implements `events_list`, `snapshot_read` and `probe` with this package, and passes its conformance kit in CI. Every project (jelly, Memory, Artifacts and any after them) is a consumer: it reads the declaration from the installed package, reads under the person's grants, and builds its own features. No consumer is privileged and none needs another.

This package holds the contract only: the data model, the descriptor schema, the protocol, the library (descriptor, events, cursor, params, permission, read, `tools-rpc`, `broker-client`), the output schema registry and the conformance kit. It holds no data, schedules nothing, needs no host, and has no runtime dependencies beyond Node built-ins. It runs on Node and Bun.

**Releases are tagged GitHub Releases, not npm.** Each tag is built in CI with `dist/`, `SHA256SUMS` and the conformance kit. Pin the exact tag (`github:we-the-rebel-alliance/source-contract#vX.Y.Z`); plugins bundle it into their own `dist/`.

## How a plugin adopts it, in five steps

1. **Declare your sources** in a top-level `sources` key of your `package.json`: `contractVersion: 1` and one item per source, with its `id` (`<plugin>.<source>`), `kind` (`events` or `snapshot`), the `tool` a read calls, `permission.operations` (what the read does at the provider), `private`, `cost` and `maxBytes`. A snapshot names an `output` from the registry. See [`examples/`](examples/) and [the contract](docs/contract.md#l1-the-descriptor).
2. **Pin the package** to a tag, `github:we-the-rebel-alliance/source-contract#vX.Y.Z`, and bundle what you import into your own `dist/`, so an install of your plugin runs no build.
3. **Implement the protocol** with the package: `events_list` or your snapshot method, and `probe`, over its `tools-rpc` transport, normalising events with `events` and cursors with `cursor`. Delete your copies of `tools-rpc.ts`, `events-list.ts`, `memory-kit.mjs` and `conformance.mjs`.
4. **Run the conformance kit** in `npm run check` and in CI, with your fixtures ([conformance](docs/conformance.md)).
5. **Release** as you do today, and attach the conformance report next to `SHA256SUMS`. Every project can then read your sources with no change of its own.

## How a project consumes it, in five steps

1. **Pin the package** to a tag, as above.
2. **Read descriptors from installed packages**, never over RPC: `readInstalledDescriptor(directory, { version })` from `descriptor` validates and hashes the `sources` key.
3. **Ask the person** and keep a grant per consumer, source, account and scope, with the descriptor hash (`permission`'s `Grant`); show `private`, the cost units and your own budgets and cadence. A changed hash asks again.
4. **Read through `read`** (or a host's broker, with `sourceReader` from `broker-client`): each read runs in a session limited to the grant's exact rules (`sessionRules`), with params, `$me` and `pick` resolved by the library.
5. **Keep your own cursor and cache**: save the cursor in the same transaction as the page you accept; `failed[]` holds it back and `refused[]` does not. A cached answer serves only a consumer whose own grant covers it.

## Modules

| Module | Does | Opened by | State |
|---|---|---|---|
| `registry` | the output schemas a snapshot source names, seeded from jelly's Home templates | the app | in `main` |
| `params`, `pick` | relative times and windows in the person's time zone, `$me`, and field selection checked against the output schema | the app, reviewed by Artifacts | in `main` |
| `descriptor` | reads `sources` from an installed package, validates the frame and hashes it | the app | in `main` |
| `permission` | exact OpenCode session rules from a grant | the app | in `main` |
| `read` | the consumer-side read in a fenced session, with detail reads and `probe` | the app | in `main` |
| `broker-client` | a host's broker when one is offered, `read` embedded otherwise | the app | in `main` |
| `schema` | the full descriptor and result schemas in zod, with JSON Schema generated | Memory | to come |
| `conformance` | the kit: the draft's ten checks, the recording permission context and the read-verb allowlist | Memory | to come |
| `events` | the one normaliser and hash, the error table and the secret-pattern refusal | the plugin family | to come |
| `cursor` | the versioned codec, bound to plugin, source, account and scope | the plugin family | to come |
| `tools-rpc` | the transport, version 2 with the version 2.3 per-method resource resolver | the plugin family | to come |

Each module is its own entry point: `import { read } from "@we-the-rebel-alliance/source-contract/read"`.

Wave 0 is in progress. No Release is tagged until the owner has reviewed v0.1.0. Docs: [the contract](docs/contract.md) and [conformance](docs/conformance.md). How to build and check the package: [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

The package is seeded from work each project had already built and tested:

- **Memory** (opencode-mem): the plugin kit, contract 2 (identity, scope, gap, declared reads), its JSON Schema, the recording permission context that proves declared grants equal what the code asserts, and the read-verb allowlist.
- **The plugin family** (the `opencode-*` plugins): contract 1, `events-list.ts` and `eventsListConformance`, implemented by nine plugins, and `tools-rpc` version 2.
- **Artifacts**: the relative-time resolver (ADR 0046) and the field picker that leaves out missing optional keys.
- **jelly** (the app): the Home template schemas that seed the output schema registry.

## Licence

MIT. See [LICENSE](LICENSE). `dist/` bundles zod (MIT); see `dist/THIRD-PARTY-NOTICES.md`.
