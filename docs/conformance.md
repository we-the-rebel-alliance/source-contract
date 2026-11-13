# Conformance

A plugin proves it keeps the contract by running the conformance kit in its own CI and attaching the report to each Release. A project's catalogue lists a source plugin only with a passing report for its pinned version.

The kit is the `conformance` module, contributed by Memory (#13), with the family's `eventsListConformance` in `events` (#7). It ships with every Release as one file, `source-contract-conformance-<version>.mjs`, which needs nothing installed.

## What it checks

The draft's ten checks, and Memory's additions:

| # | Check | Where |
|---|---|---|
| 1 | The descriptor validates, and every tool a source names is a read. | `descriptor` (the frame), then Memory's `schema` |
| 2 | **Declared equals asserted.** A recording permission context runs the fixtures and records every action and resource the code asserts: an assertion outside the declaration fails, and a declared grant no call asserts fails as over-granting. | Memory's `conformance` |
| 3 | Events: a stable `external_id`, the library's `hash`, a parseable `occurred_at`, an https `url`, and no secret pattern survives. | the family's `events` |
| 4 | Cursors round-trip with no repeat or gap; a foreign cursor is refused; an expired one answers `CURSOR_EXPIRED` with `gap`; `failed[]` holds the cursor back. | the family's `cursor`, Memory's additions |
| 5 | Another account is refused. | `read` (`ACCOUNT_MISMATCH`), the kit |
| 6 | `probe` reads no content, asserts only its own grant, and answers an owner. | Memory's `conformance` |
| 7 | A snapshot's `data` validates against its output. | `registry`, `read` |
| 8 | Paging honours `more`; the answer stays within `maxBytes`, and `TOO_LARGE` is used rather than truncation. | the kit, `read` |
| 9 | Calls stay within the declared cost. | the kit |
| 10 | Every result is marked `trust: "untrusted"`. | `read`, the kit |
| + | **The read-verb allowlist.** A read's name and each operation's last segment contain no write verb and no joiner (`get_and_save`); an operation's last segment starts with a read verb; `fetch` and `export` are never reads. | Memory's `conformance` |
| + | `details` are called only with in-scope event fields. | `read.detailFields`, Memory's `conformance` |
| + | `urlHosts` are exact hosts or `*.` with a registrable domain: no public suffix, shared hosting or punycode. | Memory's `schema` |

## Running it

The kit is a library: a plugin calls it from its own tests, with its own fixtures, and fails its check on any problem.

```js
import { assertDeclaration, assertConformance } from "@we-the-rebel-alliance/source-contract/conformance"
// or, without installing the package: import { … } from "./source-contract-conformance-<version>.mjs"
```

`assertDeclaration` checks the `sources` key (the schema, then the rules a schema cannot express). `assertConformance` runs each source through the checks above, with a fixture that answers each call. The recording permission context refuses any action the declaration does not hold, and reports any grant nothing asserted. `examples/*/fixtures/conformance.json` shows the fixture format, and `scripts/examples.ts` replays one.

## In this repository

`npm run conformance:self-test` runs on every pull request. It reads each plugin under `examples/` as a consumer finds it on disk (`readInstalledDescriptor` from `dist/`), then runs the kit over each with its recorded fixture, from `dist/` as it ships. The family's nine plugins' recorded `events_list` runs are checked by `test/fixtures.test.ts`.
