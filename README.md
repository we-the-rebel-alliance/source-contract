# source-contract

One source contract for jelly, Memory, Artifacts and every plugin (D202; design: [we-the-rebel-alliance/app#2346](https://github.com/we-the-rebel-alliance/app/issues/2346#issuecomment-6853030617)).

**Plugins are the interface for every data flow.** A plugin declares its sources once, in a top-level `sources` key in its `package.json`, implements `events_list`, `snapshot_read` and `probe` with this package, and passes its conformance kit in CI. Every project (jelly, Memory, Artifacts and any after them) is a consumer: it reads the declaration from the installed package, reads under the person's grants, and builds its own features. No consumer is privileged and none needs another.

This package holds the contract only: the data model, the descriptor schema, the protocol, the library (descriptor, events, cursor, params, permission, read, `tools-rpc`, `broker-client`), the output schema registry and the conformance kit. It holds no data, schedules nothing, needs no host, and has no runtime dependencies beyond Node built-ins. It runs on Node and Bun.

**Releases are tagged GitHub Releases, not npm.** Each tag is built in CI with `dist/`, `SHA256SUMS` and the conformance kit. Pin the exact tag (`github:we-the-rebel-alliance/source-contract#vX.Y.Z`); plugins bundle it into their own `dist/`.

## Status

Wave 0, in progress. No Release is tagged until the owner has reviewed v0.1.0.

| Module | Does | Opened by |
|---|---|---|
| `schema` | the descriptor and results in zod, with JSON Schema generated | Memory |
| `conformance` | the kit: the draft's ten checks, the recording permission context and the read-verb allowlist | Memory |
| `events` | the one normaliser and hash, and the secret-pattern refusal | the plugin family |
| `cursor` | the versioned codec, bound to plugin, source, account and scope | the plugin family |
| `tools-rpc` | the transport, version 2 with the version 2.3 per-method resource resolver | the plugin family |
| `descriptor` | reads `sources` from an installed package, validates and hashes it | the app |
| `registry` | the output schemas a snapshot source names | the app |
| `params`, `pick` | relative windows, `$me`, and field selection | the app, reviewed by Artifacts |
| `permission`, `read`, `broker-client` | exact session rules from a grant, the fenced read, and the host broker when one is offered | the app |

How to build and check it: [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

The package is seeded from work each project had already built and tested:

- **Memory** (opencode-mem): the plugin kit, contract 2 (identity, scope, gap, declared reads), its JSON Schema, the recording permission context that proves declared grants equal what the code asserts, and the read-verb allowlist.
- **The plugin family** (the `opencode-*` plugins): contract 1, `events-list.ts` and `eventsListConformance`, implemented by nine plugins, and `tools-rpc` version 2.
- **Artifacts**: the relative-time resolver (ADR 0046) and the field picker that leaves out missing optional keys.
- **jelly** (the app): the Home template schemas that seed the output schema registry.

## Licence

MIT. See [LICENSE](LICENSE). `dist/` bundles zod (MIT); see `dist/THIRD-PARTY-NOTICES.md`.
