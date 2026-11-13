# `events` and `cursor`: from contract 1 to the final design

Contract 1 is the family's `src/host/events-list.ts` (SHA-256 `9d72fc8d…605e`), byte-identical in github, granola,
gws, history, linear, plaud, slack, wisprflow and x. The final design is app#2346, comment 6853030617, §2.1 and §2.3.

**Everything is additive.** Contract 1's names, fields, limits and messages are unchanged. Every contract 1 page is a
valid page. The family's own events suite passes unchanged (`test/events-contract1.test.ts`), and the nine plugins'
recorded pages pass the package's conformance as recorded (`test/fixtures.test.ts`). Each addition is optional on the page,
and it is checked whenever it is present.

## Module layout

| Contract 1 (`events-list.ts`) | Package |
|---|---|
| the data model, `parseEventsListInput`, `makeEvent`, `eventHash`, `cut`, `oldestFirst`, `fitPage`, `eventsListResult`, `eventProblems`, `resultProblems`, the limits and the kinds | `src/internal/events.ts` |
| `eventsListConformance`, `assertEventsListConformance` | `src/internal/events-conformance.ts` |
| `encodeCursor`, `decodeCursor` | `src/cursor.ts` (also re-exported from `events`) |
| — | `src/internal/secrets.ts`: Memory's `secretKinds`, ported |

`import … from "@we-the-rebel-alliance/source-contract/events"` gives what `events-list.ts` exported, plus the additions
below, except `CONTRACT_VERSION`, which is the package entry's (`.`). A plugin adopts the package by replacing its
copy's import path. `src/events.ts` is the entry; the code is under `src/internal/`.

## The final design's page result, mapped

| Design §2.1 / §2.3 | Contract 1 | Package | Status |
|---|---|---|---|
| `events`, `cursor`, `more` | yes | unchanged | done |
| `refused[]`: final drops with a reason (instruction-shaped text from someone else, a secret, the wrong owner); the consumer may advance past them | — | `RefusedEvent { external_id, reason: "instruction" \| "secret" \| "owner", detail? }`. `screenEvents(events, { ownedBy?, instruction?, secrets? })` builds it. `detail` is one line and never holds content. An id may not also appear in `events` or `failed`. Conformance option `refused`: the ids a full listing refuses. | done; D5 |
| `failed[]`: retryable drops; any entry holds the cursor back | — | `FailedEvent { external_id, code, retryAfterSec? }`, validated on the page. The rule that it holds the cursor is the consumer's; its check is Memory's (`hooks.after`). | done; seam |
| `gap: { reason: "expired" \| "window-truncated", since }` when history is lost | — | `EventsGap`, exactly those two keys. `SourceError` carries `gap` for `CURSOR_EXPIRED`. | done; D4 |
| `cost`: what the provider reported, for billed sources | — | `EventsCost { units: [{ per, count }], usd? }`. `per` names the descriptor's `cost.units[].per`. | done; D6 |
| Cursor: opaque, versioned, bound to `(plugin, source, account, scope)`; foreign → `CURSOR_INVALID`; lost history → `CURSOR_EXPIRED` with `gap` | version 1, bound to the source only. Each plugin binds the rest in its own state (6 of 9 put the account in `a`; linear, slack and x bind only an owner hash in `o`, which all 9 carry). | `src/cursor`: version 2, `encodeBoundCursor` / `decodeBoundCursor`, with a 16-hex hash of the canonical binding. `acceptV1` reads the version 1 cursors collectors already hold. Conformance option `binding`: the same state rebound to another plugin, account or scope must be refused. | done; D12 |
| Core kinds + `task`, `file`; extensions `x-<plugin>/<kind>` | 9 kinds | `EVENT_KINDS` (11), `EXTENSION_KIND`, `isEventKind`. Conformance option `kinds`: the descriptor's `reads`. | done; D13 |
| Errors: the draft's table + `SCOPE_MISSING`, `BUDGET_EXCEEDED`, `SOURCE_DISABLED`; `AUTH_REQUIRED` aliases `NEEDS_SIGN_IN`; the message is `CODE: what happened. Next step: …` | each plugin's own codes | `ERROR_CODES` (12), `ERROR_ALIASES`, `CONTRACT1_CODES` (the family's `EVENTS_*` names), `canonicalCode`, `SourceError`, `parseSourceError`. Conformance option `codes`. | done; D3 |
| `events_list` input `scope?` | refused as an unknown field | accepted only when the source declares `scopeKeys` (`parseEventsListInput(input, { scopeKeys })`), so a source that cannot narrow never silently reads more. Keys and values are checked, and the scope is canonicalised. Optional echo on the page (`scope`); conformance option `scopeEcho`. | done; D7 |
| The draft's envelope: `plugin`, `asOf` | — | optional on the page | done; D1 |
| `maxBytes` (64 KB default, up to 1 MB) | `MAX_PAGE_BYTES` = 900 000 | `MAX_BYTES`. `fitPage(events, limit, maxBytes)`, `resultProblems(result, limit, maxBytes)` and conformance option `maxBytes`. The default stays 900 000 so contract 1 is unchanged. | done; D10 |
| The secret-pattern refusal (§3 `events`; the draft's conformance check 3) | — | `secretKinds`, Memory's `records/src/storable.js` at a70cda5, ported with types only. Used by `screenEvents`, and always checked by the conformance: an event that holds a secret belongs in `refused[]`. None of the nine fixtures trips it. | done; D14 |
| `since: "-7d"`, `$me`, `pick` | — | not here: `params` (the app and Artifacts) resolves them before the call, so a source still receives an absolute `since` | out of scope |
| `probe`, `snapshot_read`, `describe` | — | not in `events`. The probe and details checks are Memory's (`hooks`). | out of scope; D11 |

## What the nine plugins need to change to pass with every option on

The fixture runner records this, and fails if it changes:

- **Codes:** github, granola, linear, plaud, slack, wisprflow and x already pass `codes` (directly, or through
  `CONTRACT1_CODES`). **gws** refuses a bad limit or source with `GWS_VALIDATION_ERROR`. **history** refuses with no
  code at all (`The tool input is invalid. …`). Both need to change.
- **Bound cursor:** none uses version 2 yet (they cannot until the package exists). Each moves when it adopts the
  package, with `acceptV1` for one release.
- **Scope, refused, failed, gap, cost:** none emits them yet. X is Wave 1's billed reference for `cost`. gws's
  expired-history path (Gmail `historyId` too old) is the first `gap` / `CURSOR_EXPIRED`.
- Every recorded page already fits the 64 KB default `maxBytes`, and uses only core kinds.

## With the app's modules (#5)

- **One error table.** `src/internal/failure.ts` held the same twelve codes; it now takes `ERROR_CODES` from here, and
  reads a plugin's code through `canonicalCode` (`AUTH_REQUIRED`, and contract 1's `EVENTS_CURSOR_INVALID`). `read`'s
  `FailureCode` is `ErrorCode`.
- **`read` checks an events page with `resultProblems`** under the source's `maxBytes`, as its TODO asked: a page with
  §2.1's additions passes; a broken one is `SCHEMA_VIOLATION`. This makes `owner.label` required on a page read
  through `read` (D8), where `read`'s `EventsPage` type had it optional.
- **One `maxBytes` pair.** `descriptor`'s `DEFAULT_MAX_BYTES` and `MAX_BYTES_LIMIT` are `MAX_BYTES.default` and
  `MAX_BYTES.max` from here.
- **`reads` is an event kind.** `descriptor` checks a source's `reads` with `isEventKind` (a core kind or
  `x-<plugin>/<kind>`). It names one kind, while github lists four (D15).
- **Kept apart, on purpose:** `descriptor`'s `canonicalJson` and the cursor's canonical scope (the cursor must not pull
  zod into its bundle); `read`'s `EventsPage` type and `SourceEvent`/`EventsListResult` here (`read` returns the
  page as the plugin answered it); `permission`'s `Grant.scope` (lists only) and `Scope` here (a value or a list, D12).

## Decisions needed

- **D1. Required or optional.** `refused`, `failed`, `plugin` and `asOf` are optional here, and an empty list is left
  out, so contract 1 pages stay valid. Should version 1 make any of them required, or wait for version 2?
  *Recommendation:* optional in v1.
- **D2. The hash.** The draft says `hash = sha256(source:account:external_id)`. Contract 1 hashes every field, so an
  edit changes it. Memory's `normalizeEvent` hashes the content without source, account or external_id. These are
  three different hashes. *Recommendation:* keep contract 1's content hash. The consumer's id is separate (Memory
  already derives `evt_…` from `source:account:external_id`), and Memory should read the library's hash rather than
  recompute its own.
- **D3. Codes for malformed input and an unknown source.** The table has no row for either. All nine plugins refuse
  both today. The package proposes `INPUT_INVALID` and `SOURCE_UNKNOWN` (`PROPOSED_CODES`); the alternative is
  `SCHEMA_VIOLATION` for both.
- **D4. The gap.** The final design has `{ reason: "expired" | "window-truncated", since }`. Memory's contract 2 has
  `sync-token-expired | cursor-invalid | window-truncated` and an optional `until`. The package implements the
  final design's shape and refuses `until`. Should `until` be allowed? (`cursor-invalid` is `CURSOR_INVALID`, an
  error, not a gap.)
- **D5. Instruction-shaped text.** There is no default detector. A source passes its own predicate to
  `screenEvents`. Does the package own a heuristic, and who writes it? (A wrong positive drops a real event for good.)
- **D6. Cost on the page.** Is it `{ units: [{ per, count }], usd? }`? Does `usd` come from the provider, or from the
  descriptor's prices times `count`?
- **D7. The scope echo, and `setup`.** Memory's contract 2 always echoes `scope` (`{}` for the whole source) and adds
  a `setup` sentence. The final design names neither. The package echoes optionally (required only under
  `scopeEcho`) and has no `setup`.
- **D8. The owner.** The draft allows `owner: null` and an optional `label`. Contract 1 requires `{ id, label }`.
  The package keeps contract 1's shape, because Memory checks the owner before it stores anything.
- **D9. Actors.** The draft's `{ id, label? }` against contract 1's `{ role, id, name? }`. The package keeps contract
  1's.
- **D10. The default page cap.** A descriptor's `maxBytes` defaults to 64 KB and the host caps answers at it, but
  contract 1's cap is 900 000. Plugins must pass their declared `maxBytes` to `fitPage`. Should the library's default
  become 64 KB in v1? That breaks no recorded page, but it changes contract 1's constant.
- **D11. Identity.** The final design's `probe` method, or Memory's contract 2 owner-only `events_list({ limit: 0 })`?
  Contract 1 refuses `limit: 0`, and its conformance checks that refusal. The package keeps that, pending this
  decision.
- **D12. Scope canonical form.** Keys are sorted, and each list is sorted and deduplicated. A string and a one-item
  list stay different. Agreed?
- **D13. Extension kinds.** At most 64 characters. The `<plugin>` word is not checked against the plugin's id. Should
  the conformance check it against the descriptor?
- **D14. Who owns `src/internal/secrets.ts`.** It is Memory's code in a family-owned module. *Proposal:* both CODEOWNERS, with the
  same test vectors on both sides.
- **D15. One kind or several.** The descriptor's `reads` is one kind; github's source lists `commit`, `event`, `issue`
  and `pr`. Either `reads` takes a list, or github declares one source per kind.
