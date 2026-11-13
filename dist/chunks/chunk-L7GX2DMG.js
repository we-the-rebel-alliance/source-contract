// @we-the-rebel-alliance/source-contract 0.1.0. Built by scripts/build.mjs; do not edit.
import {
  isToolsRpcId
} from "./chunk-4JWSB5AE.js";
import {
  isEventKind
} from "./chunk-WJ4C2MR4.js";
import {
  _enum,
  array,
  boolean,
  discriminatedUnion,
  int,
  literal,
  looseObject,
  never,
  number,
  object,
  string,
  union,
  validator
} from "./chunk-W5SHR7DQ.js";

// src/internal/schema/types.ts
var MAX_BYTES_DEFAULT = 65536;
var MAX_BYTES_LIMIT = 1048576;

// src/internal/schema/sources.ts
var SOURCE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
var TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;
var ACTION = /^(?:[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*|[a-z][a-z0-9]*_[a-z][a-z0-9_]*)$/;
var OPERATION = /^[A-Za-z][A-Za-z0-9._-]{0,199}$/;
var SCOPE_KEY = /^[a-z][a-z0-9_]{0,31}$/;
var REGISTRY_NAME = /^[a-z][a-z0-9-]{0,31}$/;
var isOutputName = (name) => REGISTRY_NAME.test(name) || isEventKind(name);
var PRICE_PER = /^[a-z][a-z0-9-]{0,31}$/;
var HOST = /^(?:\*\.)?[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
var price = object({
  per: string().max(32).regex(PRICE_PER, { error: "must be a lowercase word such as post, author or call" }),
  usd: number().min(0)
}).strict().describe("One price unit, in US dollars, from the plugin's own price table.");
var units = array(price).min(1);
var freeCost = object({
  class: literal("free"),
  units: never({ error: "a free source states no price units" }).optional(),
  probe: never({ error: "a free source states no probe cost" }).optional()
}).strict();
var meteredCost = object({ class: literal("metered"), units, probe: price.optional() }).strict();
var billedCost = object({ class: literal("billed"), units, probe: price }).strict();
var cost = discriminatedUnion("class", [freeCost, meteredCost, billedCost], { error: "must be free, metered or billed" }).describe("What one read costs, including a probe call, which reads no content.");
var accounts = object({ named: boolean().describe("True when the source reads more than one account, so a read names one.") }).strict().describe("Which signed-in accounts a source reads.");
var scope = object({
  keys: array(string().max(32).regex(SCOPE_KEY, { error: "must be a lowercase scope key such as channels" })).describe("The scope keys a person confirms: labels, channels, repositories. Empty when there is nothing to choose."),
  describe: string().max(200).describe("The sentence shown at consent, such as Which labels."),
  suggest: object({
    tool: string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
    operations: array(string().max(200).regex(OPERATION, { error: "must be a provider operation or an MCP tool name" })).min(1)
  }).strict().optional().describe(
    "The read-only tool that lists the values a person may pick, and the operations it asserts. It runs only at bind, in the probe session; its results are shown and never stored, so its operations never enter a running grant."
  )
}).strict().describe("What a person confirms at consent, and the sentence that asks them.");
var detail = object({
  id: string().max(64).regex(SOURCE_ID, { error: "must be a dotted id such as gws.gmail.message" }),
  tool: string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
  from: array(_enum(["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"])).min(1).describe("The event fields the detail's input comes from. Identifiers only: an event's title and text are never an input.")
}).strict().describe("One read of an event's detail: the tool, and the event fields its input comes from.");
var permissionBase = {
  identity: array(string().max(200).regex(OPERATION, { error: "must be a provider operation or an MCP tool name" })).min(1).optional().describe("The identity operations probe asserts for this source (#4, #8). None may be a content operation."),
  operations: array(string().max(200).regex(OPERATION, { error: "must be a provider operation or an MCP tool name" })).min(1).optional().describe("Every operation the source's reads assert, and nothing else. Absent when `rules` states them."),
  rules: array(
    object({
      action: string().max(80).regex(ACTION, { error: "must be a permission action such as github_api" }),
      resource: string().max(200).describe("The resource the action is asserted on, such as GET /user.")
    }).strict()
  ).min(1).optional().describe("The grants verbatim, for a provider whose resources are not <account>:<operation> (GitHub's github_api on GET /user).")
};
var permissionEither = (value, ctx) => {
  if (value.operations === void 0 && value.rules === void 0) {
    ctx.addIssue({ code: "custom", message: "a permission states its operations, or its rules verbatim" });
  }
  if (value.operations !== void 0 && value.rules !== void 0) {
    ctx.addIssue({ code: "custom", message: "a permission states operations or rules, not both" });
  }
};
var permissionEvents = object({
  events: string().max(80).regex(ACTION, { error: "must be a dotted action such as gws.events_list, or a namespaced tool action such as slack_events_list" }),
  tool: never({ error: "an events source has events, not tool" }).optional(),
  ...permissionBase
}).strict().superRefine(permissionEither).describe("The events_list action, and the provider operations the source asserts.");
var permissionTool = object({
  tool: string().max(80).regex(ACTION, { error: "must be a dotted action such as gws.calendar_today, or a namespaced tool action" }),
  events: never({ error: "a snapshot has tool, not events" }).optional(),
  ...permissionBase
}).strict().superRefine(permissionEither).describe("The read tool's action, and the provider operations the source asserts.");
var cadence = object({ providerMinMinutes: int().min(1).max(10080).optional() }).strict().describe("A provider's own floor between reads. Only where the provider imposes one.");
var urlHosts = array(
  string().max(253).regex(HOST, { error: "must be a host such as slack.com, or *.slack.com" })
).describe("The hosts an event's url may point at, for display. A consumer renders a url only when its host matches.");
var common = {
  id: string().max(64).regex(SOURCE_ID, { error: "must be a dotted source id such as gws.gmail" }),
  tool: string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
  input: looseObject({}).optional().describe("The input the tool needs to reach this source. It carries no account and no secret."),
  accounts: accounts.optional(),
  scope: scope.optional(),
  private: boolean().optional().describe("True when everything this source reads is personal: shown at consent."),
  cost,
  cadence: cadence.optional(),
  maxBytes: int().min(1).max(MAX_BYTES_LIMIT).optional().meta({ default: MAX_BYTES_DEFAULT }).describe("The most bytes one result may take: default 65536 (64 KB), at most 1048576 (1 MB)."),
  retentionDays: int().min(1).optional().describe("How many days an events consumer keeps what it read."),
  urlHosts: urlHosts.optional()
};
var events = object({
  ...common,
  kind: literal("events"),
  reads: string().max(64).refine(isEventKind, { error: "must be a core kind such as message, or x-<namespace>/<name>" }).describe("The thing it reads: a core kind, or x-<namespace>/<name>, whose namespace is the source's."),
  details: array(detail).optional(),
  permission: permissionEvents,
  output: never({ error: "an events source has no output: output belongs to a snapshot" }).optional(),
  maxAgeSec: never({ error: "an events source has no maxAgeSec: a snapshot may be reused, an events page is read once" }).optional(),
  params: never({ error: "an events source has no params: events_list takes since, cursor and limit" }).optional()
}).strict().describe("An events source: append-only, ordered, read with a cursor.");
var snapshot = object({
  ...common,
  kind: literal("snapshot"),
  output: string().max(64).refine(isOutputName, { error: "must be a registry name such as agenda, or x-<namespace>/<name>" }).describe("A registry name, or x-<namespace>/<name>; an x- output carries its schema inline."),
  outputSchema: union([boolean(), looseObject({})]).optional().describe("An x- output's schema, inline: JSON Schema draft 2020-12. Required for x-, absent for a registry name."),
  params: looseObject({}).optional().describe("The parameters a consumer may pass, resolved by the library at read time."),
  permission: permissionTool,
  maxAgeSec: int().min(1).optional().describe("How long a result may be reused before it is read again."),
  reads: never({ error: "a snapshot has no reads: it is state, not a feed" }).optional(),
  details: never({ error: "a snapshot has no details: it has no events to read one of" }).optional()
}).strict().describe("A snapshot source: the latest state, read on demand.").superRefine((value, ctx) => {
  const extension = value.output.startsWith("x-");
  if (extension && value.outputSchema === void 0) {
    ctx.addIssue({ code: "custom", path: ["outputSchema"], message: "an x- output has no registry schema, so the item carries its outputSchema inline" });
  }
  if (!extension && value.outputSchema !== void 0) {
    ctx.addIssue({ code: "custom", path: ["outputSchema"], message: "a registry output names its schema, so outputSchema belongs only to an x- output" });
  }
});
var source = discriminatedUnion("kind", [events, snapshot]);
var sourcesSchema = object({
  contractVersion: literal(1),
  rpc: string().max(200).refine(isToolsRpcId, { error: "must be a tools-RPC id: the plugin id and .tools, such as google-workspace.gws.tools" }).optional().describe("The plugin's tools-RPC id (#4, #8), which a consumer calls instead of mapping the package."),
  probe: object({ action: string().max(80).regex(ACTION, { error: "must be a dotted action such as gws.probe" }) }).strict().optional().describe("The plugin's one probe tool, and the permission action it asserts (#4, #8)."),
  items: array(source).min(1).describe("The plugin's sources. A source id is unique across the declaration.")
}).strict();

// src/schema.ts
var SOURCES_SCHEMA = validator("sources", sourcesSchema);

export {
  MAX_BYTES_DEFAULT,
  MAX_BYTES_LIMIT,
  SOURCES_SCHEMA
};
