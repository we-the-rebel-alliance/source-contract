# The nine event plugins' `events_list` fixtures

There is one file per plugin. Each holds every call that `eventsListConformance` made in that plugin's own
conformance test, against the plugin's own fake, together with what the call answered: the result, or the error's
first line. Replayed through `replay.ts`, each run gives the same calls the same answers. `fixtures.test.ts` checks
that every run passes the package's conformance as recorded, and again with the extended page result.

| File | Source | Runs | Calls | Recorded from |
|---|---|---|---|---|
| `github.json` | `github` | 3 | 43 | `joe-broadhead/opencode-github@fe898aa`, `test/unit/events-list.test.ts` |
| `granola.json` | `granola` | 2 | 25 | `joe-broadhead/opencode-granola@ff21ac6`, `test/events.test.ts` |
| `gws.json` | `gmail` | 3 | 35 | `joe-broadhead/opencode-gws@90b6316`, `test/gmail-events.test.ts` (the fake gws over `test/fixtures/gmail-mailbox.json`) |
| `history.json` | `history` | 2 | 26 | `joe-broadhead/opencode-history@e238981`, `test/unit/query/events.test.ts` |
| `linear.json` | `linear` | 3 | 38 | `joe-broadhead/opencode-linear@98eb150`, `test/unit/events.test.ts` |
| `plaud.json` | `plaud` | 3 | 42 | `joe-broadhead/opencode-plaud@9a6f505`, `test/events.test.ts` |
| `slack.json` | `slack` | 3 | 35 | `joe-broadhead/opencode-slack@b32b401`, `test/unit/events.test.ts` |
| `wisprflow.json` | `wisprflow` | 3 | 40 | `joe-broadhead/opencode-wisprflow@fa05079`, `test/unit/events.test.ts` |
| `x.json` | `x` | 3 | 38 | `joe-broadhead/opencode-x@627df02`, `test/unit/events.test.ts` |

Every commit is the plugin's default branch on 2026-11-13, and each commit's `src/host/events-list.ts` is contract 1
(SHA-256 `9d72fc8d…605e`). The full commit ids are in each file's `recordedFrom`.

## Sanitised

The data is the plugins' own synthetic test data: people at `example.com`, `example.org` and `example.test`,
workspaces named Acme, and made-up ids. Nothing here came from a real account. `sanitise.ts` is checked when a fixture
is written and again by the runner. It finds nothing in these files:

- no secret pattern (Memory's detector, `secretKinds`);
- no local path;
- no email outside `example.com`, `example.org` and `example.test`;
- no URL host outside the fakes' own: `github.com`, `linear.app`, `x.com`, `acme.slack.com`, `notes.example.test`,
  `mail.google.com` and `notes.wisprflow.ai`, each with synthetic paths.

The cursors are each plugin's version 1 cursors. Their owner field `o` is a hash of the fake's owner, not an id.

## Recording them again

Recording is done outside this repository, in a checkout of each plugin. Patch that checkout's
`src/host/events-list.ts` so `eventsListConformance` writes each run to `$WAVE0_RECORD` (the staging patch; never
commit it), then run the plugin's events test with `WAVE0_RECORD=<dir> WAVE0_PLUGIN=<name>`. Finally, build the
files with the staging builder, which refuses any recording that has conformance problems or fails `sanitise.ts`.
