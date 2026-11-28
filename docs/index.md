# Documentation

Every page in this repository, one line each. The contract and the plugin standard are the authority; a module page
describes the entry point a plugin or an app imports.

## Start here

- [The contract, v0](contract.md): the whole agreement — manifest, accounts, methods and access, sources, actions, doors,
  bus events, status, errors, trust, catalog, modules, conformance and versions.
- [The plugin standard](plugin-standard.md): what every `<name>-plugin` repository must be, and the definition of done.
- [How an app uses the contract](consumers.md): discover, read with cursors, subscribe, act, the grant flow from an app
  UI, the access levels, the audit report and the error table.
- [Decisions](decisions.md): the settled decisions behind v0, and the two questions still with the lead.

## Plugin modules

- [plugin-contract](plugin-contract.md): the root entry — the contract wire version and the plain validator types.
- [manifest](manifest.md): the `capabilities` key, its schema, validation, lookups and canonical hash.
- [accounts](accounts.md): profiles, names, registration through integrations or MCP, `account` resolution and status.
- [access](access.md): the three access levels as permission rules, and the fenced sessions a grant compiles to.
- [register](register.md): doors 1–3 from one handler table, with input, account, permission and output checks.
- [events](events.md): the event and page model, the normaliser, hash, secret screening and the error table.
- [cursor](cursor.md): the opaque cursor codec, bound to plugin, source, account and scope.
- [bus](bus.md): typed `changed`, `status` and `account` nudges a handler emits on `call.bus`, and the reader.
- [grant](grant.md): the host-signed, single-use action grant — format, signer, verifier and every code.
- [grant fences](access.md#grant-fences): the session rules a grant compiles to, on the same page as `access`.
- [hints](hints.md): the generic hint file a source may ship for a model-based consumer.
- [schemas](schemas.md): every JSON Schema the package publishes, by name.

## App modules

- [read](read.md): fenced reads, detail reads and `probe`, through the catalog or embedded.
- [act](act.md): preview then commit of a register-minted plan under a host-signed action grant.
- [audit](audit.md): what each installed plugin may read and do for a person, with the grant behind it, as a report and
  deterministic Markdown.
- [params](params.md): relative times, windows and `$me`, resolved at read time.
- [pick](pick.md): field selection, checked against the output's schema.
- [catalog](catalog.md): installed manifests, the broker request and the consumer's reader.
- [outputs](outputs.md): the snapshot shape registry and its JSON Schemas.

## Conformance and the kit

- [conformance](conformance.md): T0, T1 and every recorded check, as one report.
- [kit](kit.md): the `plugin-kit` binary, its commands, the host harness and the release guards.

## Repository guides

- [README](../README.md): what the package is, the five doors, every module and the install line.
- [AGENTS.md](../AGENTS.md): the working guide for an agent in this repository.
- [AGENTS.template.md](../AGENTS.template.md): the agent guide every plugin starts from.
- [SUPPORTED.md](../SUPPORTED.md): the plugins and their state at this contract version.
- [CHANGELOG.md](../CHANGELOG.md): what each release contains; v0.0.0 is the first.
- [CONTRIBUTING.md](../CONTRIBUTING.md): how to build, check and release this package.
