# Conformance

A plugin proves it keeps the contract by running the conformance kit in its own CI and attaching the report to each Release. A project's catalogue lists a source plugin only with a passing report for its pinned version.

The kit is the `conformance` module, which Memory contributes (with the family's `eventsListConformance`), and it ships with every Release as one file, `source-contract-conformance-<version>.mjs`, which needs nothing installed. The `schema` module holds the descriptor's validator, and its JSON Schema is `dist/schemas/sources.json`.

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
| + | **The verb rule.** Names are tokenised (snake, kebab, dot, camelCase); an unambiguous write verb anywhere is refused; a compound (`get_and_send`, `getAndSend`) is refused; a noun-verb in a verb's position with an object after it is a write (`slack_post_message`), while `get_issue` and a single-token `drive.files.export` are reads; an operation's last segment carries no write verb and a noun may lead it (`x.users.mentions`). | Memory's `conformance` |
| + | `details` are called inside the confirmed scope, and an event outside it must be refused with `PERMISSION_DENIED: … Next step: …`. | `read` (`detailFields`), Memory's `conformance` |
| + | **Refused is final**, and the secret screening is proven from a fixture: an event whose `title` or `text` holds a secret (`secretKinds`) fails, and it belongs in `refused[]` with `reason: "secret"`. | the family's `events`, Memory's `conformance` |
| + | `urlHosts` are exact hosts or `*.` with a registrable domain: no public suffix, shared hosting or punycode. | Memory's `schema`, `conformance` |

## Running it

From a test, with the package pinned:

```js
import { SOURCES_SCHEMA } from "@we-the-rebel-alliance/source-contract/schema"
import { sourceConformance, assertConformance } from "@we-the-rebel-alliance/source-contract/conformance"

const { sources } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).sources
const declared = SOURCES_SCHEMA.parse(sources)
assertConformance(await sourceConformance({ plugin, source: declared.items[0], tools, cases, calls }))
```

`calls` hands the kit your own `list`, `probe`, `details` and `suggest`, each taking a recording permission context; the
fixtures are your own offline answers. A read that asserts more than the declaration holds is refused as the host
refuses it, and a declared grant no read asserts is reported.

Every check that applies must run: a source that never exercises `failed[]`, `gap`, `refused[]` or `details` has an
*incomplete* report, which is not ok.

## A page that cannot fail one item

A page fetched in one provider call cannot produce `failed[]`: Calendar's `events.list` answers the whole page at once,
so no single item can fail on its own. Such a source says so:

```js
await sourceConformance({ ...options, atomicPages: { reason: "events.list answers the page in one call" } })
```

`failed-holds-cursor` is then not applicable, the reason is shown in the report's check, and the report can be ok. An
empty reason is no reason: the check applies, and the report is incomplete.

## Proving the secret screening

`refused-is-final` is mandatory for every events source, because the contract screens every result for secrets. A
plugin proves it with a fixture that carries a secret-shaped event the source refuses:

```json
"refused": [{ "external_id": "18f00000000000aa", "reason": "secret", "detail": "api key" }]
```

The kit runs the family's `secretKinds` over every page's `title` and `text`: an event that holds a secret fails the
check, so a fixture that merely declares the screening cannot pass. `refused[]`'s `reason` is one of `instruction`,
`secret` and `owner`, and `failed[]`'s is an error `code`, both as `events` defines them.

## In this repository

`npm run conformance:self-test` runs on every pull request. It reads each plugin under `examples/` twice on purpose:
once as a consumer finds it on disk (`readInstalledDescriptor` from `dist/`, which hashes it), and once through the kit.
Every recorded page is validated by the family's `events` module (`resultProblems`), so the examples keep the event and
page shape the authority defines. The examples are gws Gmail, gws Calendar and Slack, with Memory's sanitised fixtures.
