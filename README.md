# source-contract

One source contract for jelly, Memory, Artifacts and every plugin (D202; design: [we-the-rebel-alliance/app#2346](https://github.com/we-the-rebel-alliance/app/issues/2346#issuecomment-6853030617)).

**Plugins are the interface for every data flow.** A plugin declares its sources once, in a top-level `sources` key in its `package.json`, implements `events_list`, `snapshot_read` and `probe` with this package, and passes its conformance kit in CI. Every project (jelly, Memory, Artifacts and any after them) is a consumer: it reads the declaration from the installed package, reads under the person's grants, and builds its own features. No consumer is privileged and none needs another.

This package holds the contract only: the data model, the descriptor schema, the protocol, the library (descriptor, events, cursor, params, permission, read, `tools-rpc`, `broker-client`), the output schema registry and the conformance kit. It holds no data, schedules nothing, needs no host, and has no runtime dependencies beyond Node built-ins. It runs on Node and Bun.

**Releases are tagged GitHub Releases, not npm.** Each tag is built in CI with `dist/`, `SHA256SUMS` and the conformance kit. Pin the exact tag (`github:we-the-rebel-alliance/source-contract#vX.Y.Z`); plugins bundle it into their own `dist/`.

Status: Wave 0, in progress.
