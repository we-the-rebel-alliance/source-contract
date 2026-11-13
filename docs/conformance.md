# Conformance

A plugin proves it keeps the contract by running the conformance kit in its own CI and attaching the report to each Release. A project's catalogue lists a source plugin only with a passing report for its pinned version.

The kit is the `conformance` module, which Memory contributes (with the family's `eventsListConformance`), and it ships with every Release as one file, `source-contract-conformance-<version>.mjs`, which needs nothing installed. Until it lands, this page describes what it checks and what is already checked.

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

In a plugin, once the kit is in a Release:

```sh
node source-contract-conformance-<version>.mjs <your plugin directory>
```

or, with the package pinned, from a test that calls the kit's functions with your fixtures. The fixtures are your own offline answers: a fixture answers each call, and the recording session refuses any action the declaration does not hold.

## In this repository

`npm run conformance:self-test` runs on every pull request. It reads each plugin under `examples/` as a consumer finds it on disk (`readInstalledDescriptor` from `dist/`), and, once the kit lands, runs the kit over each, with the family's nine plugins' fixtures and Memory's gws and Slack fixtures.
