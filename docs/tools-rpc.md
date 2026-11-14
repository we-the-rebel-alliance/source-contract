# `tools-rpc` v2.3: what changed from the family's v2, and from Memory's v2.3

- **Base: the family's v2.** This is the shared part of `src/host/tools-rpc.ts`, everything outside the
  PLUGIN-SPECIFIC markers. It is identical in all 24 plugins, which was checked on each one's default branch:
  SHA-256 of the shared part is `15d82caa53aaae7ad9efb88dddb97056d3895c4dbf49b8efbb85b743871b2a6d`, the hash every
  `check-copies.mjs` pins.
- **Merged in: Memory's v2.3**, the opt-in per-method resource resolver. It is described in opencode-mem
  `feat/plugin-kit`, `plugin-kit/README.md` §"`operationScoped`" (revision 7), and in commit `1863255`.

**Proof that v2 is unchanged.** The family's two shared suites, gws's `test/tools-rpc.test.ts` (44 tests) and
`test/tools-rpc-resolve.test.ts` (the 30-test resolve matrix), are copied verbatim into `test/tools-rpc.test.ts`
and `test/tools-rpc-resolve.test.ts`. Only their imports changed, plus `plugin: PLUGIN` in their one `registerToolsRpc` call. All 74
pass on `node --test` and `bun test`. `test/tools-rpc-resource.test.ts` (13 tests) covers v2.3.

## Changes from v2

### Packaging: the block becomes a value, and the host types become structural

| # | v2 | Package | Why |
|---|---|---|---|
| 1 | The PLUGIN-SPECIFIC block exports `PLUGIN_ID`, `METHODS`, `NEXT_STEPS`, `shapeInput`, `shapeResult` and `pluginError`, and the shared part reads them at module level. | `registerToolsRpc(ctx, { plugin, methods, … })`, where `plugin: ToolsRpcPlugin = { id, nextSteps, shapeInput?, shapeResult?, pluginError? }`. `methods` is v2's `METHODS` option, unchanged. | A package cannot have a block edited between markers. The block's exports become one argument. |
| 2 | `export const TOOLS_RPC_ID` | `toolsRpcId(pluginId)`. The contract's id is `<plugin.id>.tools`, as before. | The id is per plugin. |
| 3 | `NEXT_STEPS` is a module export, read at each call. | `plugin.nextSteps`, also read at each call, so a plugin (or a test) that changes a step sees it at once. | Same behaviour. |
| 4 | `shapeInput`, `shapeResult` and `pluginError` are required block exports. | Optional. Their absence is the identity shapers and "no plugin error", which most blocks spell out by hand today. A block with its own (gws's `pluginError`, X's shapers) passes them. | Less boilerplate, same behaviour. |
| 5 | `import { Rpc } from "@opencode/plugin/rpc"`, then `Rpc.define(...)`. | `defineRpc(...)`, inlined: the identity plus `Rpc.define`'s one check (an error name starting with `rpc.` is reserved), copied from `@opencode/schema` 2.2.3. | No runtime dependency. The contract object is the same. |
| 6 | `import type { Plugin } from "@opencode/plugin"`; `ToolsRpcContext = Pick<Plugin.Context, …>`; `Tool` and `ToolResult` derived from it. | `ToolsRpcContext`, `HostTool` and `HostEvaluation`, written structurally: exactly the members the module reads. | No type dependency either. A plugin passes its `ctx` (a cast if the host's types are branded, as the suites' `ctx as never` already does). |
| 7 | `normalise` reads `part.text` (typed `string`). | `part.text ?? ""`. | The structural type has `text?` optional. The output is unchanged for every text part the host sends. |
| 8 | `Rule`, `Failure`, `NextSteps` and `Code` are module-private. | Exported. | A plugin types its `plugin` value with them. |

### v2.3: the resource resolver (opt-in)

| # | Change | Behaviour |
|---|---|---|
| 9 | `PluginMethod.resource?(input): string \| null` | Opt-in, per plugin method. It returns the `<account>:<operation>` the call acts on, the same resource the direct tool path asserts (gws: `work:gmail.users.messages.get`). |
| 10 | `evaluate(rules, action, resource = "*")` | The host's last-match-wins rule, now on a given resource. On `*` it is v2's `evaluate` exactly. `hidden` still evaluates on `*`. It is `permission`'s `evaluate`, re-exported: the one evaluation the fenced session's rules and the resolve share. |
| 11 | Resolve before dispatch on the resource | After the session lookup (so `SESSION_UNKNOWN` and `SESSION_AGENT_REQUIRED` keep v2's precedence) and before any run, a method with a resolver is resolved on its resource. Only `allow` runs. The `ask` and `deny` messages name `<action> on <resource>`, and the next step names the rule for that resource. A method without a resolver resolves on `*` with v2's wording, word for word. |
| 12 | `null` (or a throw, or anything that is not `<account>:<operation>`) is refused | New code `RESOURCE_UNRESOLVED`: "`<method>`'s input names no account and operation for `<action>` to be resolved on". There is a shared default next step, which `plugin.nextSteps.RESOURCE_UNRESOLVED` may override. Nothing runs. |
| 13 | A read method's operation must be a read | For `class: "read"` only, the operation's last dotted segment must be a read verb, or start with one followed by a capital or `_` (`get`, `getProfile`, `list`, `searchContacts`). `READ_VERBS` is Memory's list: read, get, list, search, lookup, view, describe, history, query, count, status. Otherwise `PERMISSION_DENIED`, with no run. This refuses `messages.insert`, `batchModify`, `watch`, `quickAdd`, `untrash` and `emptyTrash`, as Memory requires, and also `getaway`, `listing` and `batchGet`. A write method may resolve a write operation. |
| 14 | `RESOURCE_PATTERN` | `<account>:<operation>`. The account is `permission`'s `ACCOUNT_PATTERN`: no `:`, whitespace or wildcard, at most 320 characters. The operation is dotted words. A wildcard or a malformed resource from a resolver is `RESOURCE_UNRESOLVED`, so a resolver can never widen a grant to `*`. |
| 15 | `ToolCall.resource` | The resolved resource, passed to `run`, so the spec can assert exactly what was resolved. Absent without a resolver. |
| 16 | `describe` | A method with a resolver carries `operationScoped: true`. The `DESCRIBED` schema gains that optional boolean. `permission` stays the effect on `*`, since a resolver needs an input. |
| 17 | Registration | A `resource` that is not a function is refused. So is a resolver on an MCP method: an MCP tool is asserted by OpenCode's executor on `*`, so a resolver there would promise a check nothing makes. |

Without a resolver nothing changes: no method in the 24 plugins has one today, so adopting the package changes no
behaviour until a plugin adds a resolver.

## The tools-RPC id (source-contract#4)

A plugin's tools RPC is `<plugin id>.tools` (`toolsRpcId`), where the plugin id is OpenCode's: lowercase dotted
words, such as `google-workspace.gws`. This is not the descriptor's source-id prefix (`gws`). `registerToolsRpc`
refuses any other shape.

A descriptor that names the id lets a consumer call the plugin without guessing. `toolsRpcIdProblems(declared,
describe?)` checks the declared id, and compares it with the plugin's `describe` answer when the consumer has one.
That comparison is diagnostic only: RPC ids have no owner in OpenCode.

## Differences from Memory's v2.3

**Memory's file could not be read.** Memory's README names its canonical copy as
`opencode-release-rpc/shared-v2/tools-rpc.ts` in the plugin family, SHA-256
`9210d0a531788d1f0d70d44a13a032816ef240b04aa5303f6ba4b2e2a52b6c94`. There is no `opencode-release-rpc` repository
under the family's GitHub account. No file on the build machine has that hash: every `tools-rpc.ts` under the
workspace was checked. Neither opencode-mem branch carries the file. So the merge follows Memory's documented
contract, point by point:

| Memory's v2.3, as documented | Here |
|---|---|
| "an opt-in `resource(input) → string \| null` on a plugin method, resolved before dispatch" | #9, #11 |
| "`null` is refused, naming the input" | #12. The message names the method's input and the action. **Code to agree:** `RESOURCE_UNRESOLVED` (decision T1). |
| "a method with no resolver keeps `*`, so the change is additive" | #10, #11. The 74 v2 tests pass verbatim. |
| "the operation's last dotted segment must start with a read verb (an allowlist), so `messages.insert`, `batchModify`, `watch`, `quickAdd`, `emptyTrash` and `untrash` are refused" | #13. **To agree:** that it applies to `class: "read"` methods only (T2), and the "starts with" rule: a verb, then the end, a capital or `_` (T3). |
| "returning the same `<account>:<operation>` the direct tool path builds" | #14 checks the shape. Whether it is the same as the direct path is each plugin's test, against its own tool. |
| "copy that file byte for byte (the family's copy check pins the hash)" | **Replaced by the package.** The kit's `operationScoped` prerequisite must name the package version (the first tag with this module) instead of hash `9210d0a5…` (T4). |

Not in Memory's description, and added here: `ToolCall.resource` (#15), `describe`'s `operationScoped` (#16), and
the registration checks (#17). Memory's text could not be compared byte for byte; any other difference there is
unknown until that file is shared.

## Decisions needed

- **T1.** The code for a resolver that names no resource: `RESOURCE_UNRESOLVED` (new), or the events table's
  proposed `INPUT_INVALID`?
- **T2.** The read-verb rule applies to `class: "read"` methods only, so a write method (gws's commit methods under
  `rpcCommits`) can resolve a write operation. Agreed?
- **T3.** "Starts with a read verb": `getProfile` and `lookup_by_id` pass; `getaway`, `listing` and `batchGet` are
  refused. Gmail's `users.messages.batchGet`-style reads would need the list to grow.
- **T4.** Memory's kit and README pin `tools-rpc.ts` v2.3 by hash `9210d0a5…`. With the package, the prerequisite
  becomes "the package at ≥ the tag that ships this". Memory updates `plugin-kit/README.md` and `memory-kit.mjs`'s
  check.
- **T5.** The host types are structural, so the package needs no `@opencode/plugin`. Is a cast at the call site
  (`registerToolsRpc(ctx as never, …)`) acceptable for plugins whose host types are branded, or should the package
  carry an optional peer type import?
