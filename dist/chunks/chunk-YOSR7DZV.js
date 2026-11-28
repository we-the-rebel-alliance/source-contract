// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  isExtensionOutput,
  isOutputName
} from "./chunk-UY2FWVSQ.js";
import {
  ACCOUNT_MECHANISMS,
  ACTION_EFFECTS,
  COST_CLASSES,
  DETAIL_FIELDS,
  ERROR_CODES,
  ERROR_SURFACES,
  EVENT_KINDS,
  EXTENSION_KEY,
  FACT_TYPES,
  MANIFEST_VERSION,
  MAX_BYTES_DEFAULT,
  MAX_BYTES_LIMIT,
  METHOD_ACCOUNTS,
  METHOD_CLASSES,
  METHOD_EFFECTS,
  OPENCODE_RANGE,
  PLUGIN_NAME,
  SERVICE_ID_MAX,
  SERVICE_LABEL_MAX,
  SOURCE_SIGNALS,
  TESTED_OPENCODE,
  isEventKindIn
} from "./chunk-RUQH3YH7.js";
import {
  _enum,
  array,
  boolean,
  discriminatedUnion,
  fromJSONSchema,
  literal,
  looseObject,
  number,
  record,
  strictObject,
  string,
  toJSONSchema,
  unknown
} from "./chunk-AYJEC7Y2.js";

// src/manifest/canonical.ts
import { createHash } from "node:crypto";
function canonicalJson(value) {
  return write(value, /* @__PURE__ */ new Set());
}
function write(value, seen) {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error("canonical JSON cannot represent a number that is not finite");
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "undefined":
      return "null";
    case "object":
      break;
    default:
      throw new Error(`canonical JSON cannot represent a ${typeof value}`);
  }
  const object = value;
  if (seen.has(object)) throw new Error("canonical JSON cannot represent a cycle");
  seen.add(object);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => write(item, seen)).join(",")}]`;
    const record2 = value;
    const entries = [];
    for (const key of Object.keys(record2).sort()) {
      const item = record2[key];
      if (item === void 0) continue;
      entries.push(`${JSON.stringify(key)}:${write(item, seen)}`);
    }
    return `{${entries.join(",")}}`;
  } finally {
    seen.delete(object);
  }
}
function manifestHash(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

// src/manifest/schema.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var METHOD_NAME = /^[a-z][a-z0-9_]*$/;
var MCP_METHOD_NAME = /^mcp:(?:[A-Za-z0-9][A-Za-z0-9_.-]{0,99}|\*)$/;
var SOURCE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
var SCOPE_KEY = /^[a-z][a-z0-9_]{0,31}$/;
var OPERATION = /^[A-Za-z][A-Za-z0-9._-]{0,199}$/;
var HOST = /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
var SCHEME = /^[a-z][a-z0-9+.-]{0,31}$/;
var VENDOR_ID = /^[a-z][a-z0-9-]{0,31}$/;
var DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
var ICON_TYPE = /^image\/[a-z0-9][a-z0-9.+-]*$/;
var FILE_PATH = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*\.md$/;
var PRICE_PER = /^[a-z][a-z0-9-]{0,31}$/;
var ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
var PROFILE_REF = "#/options/properties/accounts/additionalProperties";
var nonEmpty = (max) => string().min(1).max(max);
var vendor = strictObject({
  id: string().regex(VENDOR_ID, { error: "must be a lowercase vendor id such as google" }),
  name: nonEmpty(80),
  domain: string().regex(DOMAIN, { error: "must be a domain such as google.com, with no scheme or path" })
}).describe("Who makes the provider the plugin talks to.");
var icon = strictObject({
  src: string().min(1).max(200).describe("A path inside the installed package, such as assets/icon.svg."),
  type: string().regex(ICON_TYPE, { error: "must be an image MIME type such as image/svg+xml" })
}).describe("One icon the package ships.");
var host = strictObject({
  opencode: literal(OPENCODE_RANGE, { error: `must be exactly "${OPENCODE_RANGE}" in version 1 of the contract` }),
  tested: array(string().min(1).max(40)).min(1).describe(`The OpenCode releases CI ran. It includes ${TESTED_OPENCODE}.`)
}).superRefine((value, context) => {
  if (!value.tested.includes(TESTED_OPENCODE)) context.addIssue({ code: "custom", path: ["tested"], message: `must include ${TESTED_OPENCODE}, the release this contract is tested on` });
  if (new Set(value.tested).size !== value.tested.length) context.addIssue({ code: "custom", path: ["tested"], message: "must not repeat a release" });
}).describe("The OpenCode range, and the releases the plugin was tested on.");
var plugin = strictObject({
  name: string().regex(PLUGIN_NAME, { error: "must be 1 to 31 lowercase letters or digits, with no hyphen" }),
  title: nonEmpty(80),
  summary: nonEmpty(300),
  vendor,
  icons: array(icon).min(1).describe("At least one icon; a consumer picks the size it needs."),
  host
}).describe("The plugin's identity, title, summary, vendor, icons and OpenCode range.");
var accountsInfo = strictObject({
  via: _enum(ACCOUNT_MECHANISMS),
  profile: strictObject({ $ref: literal(PROFILE_REF, { error: `must be { "$ref": "${PROFILE_REF}" }` }) }).describe("A JSON-Schema $ref to the profile schema in options.").optional(),
  owner: string().regex(SCHEME, { error: "must be a scheme such as mailto" })
}).describe("How accounts work. Absent: the plugin signs in to nothing.");
var methodName = string().refine((value) => METHOD_NAME.test(value) || MCP_METHOD_NAME.test(value), {
  error: "must be a method name such as events_list, or mcp:<tool> / mcp:*"
});
var methodItem = strictObject({
  class: _enum(METHOD_CLASSES),
  description: string().min(1).optional().describe("The tool's description. Not on mcp:*, which has no one tool."),
  input: record(string(), unknown()).optional().describe("The tool's input, as JSON Schema 2020-12. Not on mcp:*, which has no one tool."),
  accounts: _enum(METHOD_ACCOUNTS).optional().describe("optional when the method takes an account, none when it does not. Defaults to none."),
  operations: array(string().regex(OPERATION, { error: "must be a provider operation of letters, digits, dots, underscores or hyphens" })).min(1).optional(),
  plans: literal(true).optional().describe("The method dry-runs a change and answers { planId, method }."),
  commits: methodName.optional().describe("The planning method this method commits. It then takes only { planId }."),
  effect: _enum(METHOD_EFFECTS).optional().describe("A narrowing of the access setting: ask or deny, never allow."),
  pinned: literal(true).optional().describe("The one method Code Mode sends on every turn. None by default.")
}).superRefine((value, context) => {
  if (value.plans === true && value.commits !== void 0) context.addIssue({ code: "custom", path: ["commits"], message: "a method either plans a change or commits one, not both" });
  if (value.commits !== void 0 && !METHOD_NAME.test(value.commits)) {
    context.addIssue({ code: "custom", path: ["commits"], message: "must name a declared method" });
  }
  if (value.operations !== void 0 && new Set(value.operations).size !== value.operations.length) {
    context.addIssue({ code: "custom", path: ["operations"], message: "must not repeat an operation" });
  }
}).describe("One callable: a contract method, a plugin tool or a pass-through MCP tool.");
var service = strictObject({
  id: string().min(1).max(SERVICE_ID_MAX),
  label: string().min(1).max(SERVICE_LABEL_MAX)
}).describe("The outside system a source belongs to. Sources with the same id are one service with one label.");
var price = strictObject({
  per: string().regex(PRICE_PER, { error: "must be a lowercase word such as post or call" }),
  usd: number().finite().nonnegative()
});
var cost = strictObject({
  class: _enum(COST_CLASSES),
  units: array(price).min(1).optional()
}).superRefine((value, context) => {
  if (value.class === "free" && value.units !== void 0) context.addIssue({ code: "custom", path: ["units"], message: "a free source states no price units" });
  if (value.class !== "free" && value.units === void 0) context.addIssue({ code: "custom", path: ["units"], message: `a ${value.class} source must state its price units` });
}).describe("What one read costs. A billed or metered source states its price units.");
var scope = strictObject({
  keys: array(string().regex(SCOPE_KEY, { error: "must be a lowercase scope key such as channels" })).min(1).describe("The keys a person confirms: labels, channels, repositories."),
  describe: string().min(1).max(200),
  suggest: strictObject({ method: methodName, operations: array(string().regex(OPERATION)).min(1).optional() }).describe("The read-only method that lists the values a person may pick.").optional()
}).superRefine((value, context) => {
  if (new Set(value.keys).size !== value.keys.length) context.addIssue({ code: "custom", path: ["keys"], message: "must not repeat a key" });
}).describe("What a person confirms at consent.");
var cadence = strictObject({
  providerMinMinutes: number().int().positive().optional(),
  suggestMinutes: number().int().positive().optional()
}).describe("The provider's floor between reads, and a suggested cadence, in minutes.");
var detail = strictObject({
  id: string().regex(SOURCE_ID, { error: "must be a dotted, lowercase detail id such as gws.gmail.message" }),
  method: methodName,
  from: array(_enum(DETAIL_FIELDS)).min(1).describe("The event fields the detail's input comes from: identifiers, never the event's prose.")
}).describe("One follow-up read of an event's detail.");
var sourceBase = {
  id: string().regex(SOURCE_ID, { error: "must be a dotted, lowercase source id such as gws.gmail" }),
  method: methodName.describe("The declared method that reads this source."),
  input: record(string(), unknown()).optional().describe("The fixed input that selects this source."),
  service: service.optional(),
  operations: array(string().regex(OPERATION, { error: "must be a provider operation" })).min(1).optional(),
  scope: scope.optional(),
  cadence: cadence.optional(),
  signals: array(_enum(SOURCE_SIGNALS)).min(1).optional(),
  private: boolean().optional(),
  cost,
  maxBytes: number().int().positive().max(MAX_BYTES_LIMIT, { error: `must be at most ${MAX_BYTES_LIMIT} (1 MB)` }).optional(),
  details: array(detail).min(1).optional(),
  facts: array(_enum(FACT_TYPES)).min(1).optional(),
  hints: array(string().max(200).regex(FILE_PATH, { error: "must be a relative path in the package ending in .md" })).min(1).optional(),
  urlHosts: array(string().regex(HOST, { error: "must be a lowercase domain, or *. and a domain for its subdomains" })).min(1).optional().describe("The hosts an event's url and thumbnail may point at.")
};
var eventsSource = strictObject({
  ...sourceBase,
  kind: literal("events"),
  reads: string().describe("A core event kind, or x-<name>/<kind>."),
  thumbnails: literal(true).optional().describe("The source can answer an event's thumbnail (#42). Requires urlHosts.")
}).superRefine((value, context) => {
  if (value.thumbnails === true && value.urlHosts === void 0) context.addIssue({ code: "custom", path: ["thumbnails"], message: "a source that declares thumbnails must declare urlHosts" });
  if (value.signals !== void 0 && new Set(value.signals).size !== value.signals.length) context.addIssue({ code: "custom", path: ["signals"], message: "must not repeat a signal" });
  if (value.details !== void 0 && new Set(value.details.map((entry) => entry.id)).size !== value.details.length) context.addIssue({ code: "custom", path: ["details"], message: "must not repeat a detail id" });
}).describe("An events source: append-only items read with a cursor.");
var snapshotSource = strictObject({
  ...sourceBase,
  kind: literal("snapshot"),
  output: string().describe("A registry output name such as agenda, or x-<namespace>/<name>.")
}).superRefine((value, context) => {
  const output = value.output;
  if (!isOutputName(output) && !isExtensionOutput(output)) context.addIssue({ code: "custom", path: ["output"], message: `"${output}" is not a registered output and not an x-<namespace>/<name>` });
  if (value.signals !== void 0 && new Set(value.signals).size !== value.signals.length) context.addIssue({ code: "custom", path: ["signals"], message: "must not repeat a signal" });
  if (value.details !== void 0) context.addIssue({ code: "custom", path: ["details"], message: "only an events source has detail reads" });
}).describe("A snapshot source: the latest state, read on demand.");
var source = discriminatedUnion("kind", [eventsSource, snapshotSource]).describe("A source: an events feed or a snapshot.");
var action = strictObject({
  id: string().regex(SOURCE_ID, { error: "must be a dotted, lowercase action id such as gws.gmail.send" }),
  effect: _enum(ACTION_EFFECTS),
  preview: methodName.describe("The declared method that previews the action. It writes nothing."),
  commit: methodName.describe("The declared method that commits the action. A different method from preview."),
  input: record(string(), unknown()).describe("JSON Schema 2020-12 for the caller's input."),
  output: record(string(), unknown()).describe("JSON Schema 2020-12 for the answer's output.")
}).describe("One write an app can offer a person.");
var events = strictObject({
  changed: strictObject({}).optional().describe("The plugin knows a source changed."),
  status: strictObject({}).optional().describe("The plugin's state changed."),
  account: strictObject({}).optional().describe("An account signed in, out, or needs sign-in.")
}).describe("The bus events the plugin emits. Each is declared with an empty object.");
var errorItem = strictObject({
  surface: _enum(ERROR_SURFACES),
  meaning: string().min(1).max(200).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), { error: "must be one line of plain text" })
}).describe("One error code the plugin declares beyond the contract's table.");
var errorsField = record(string(), errorItem).superRefine((codes, context) => {
  for (const name of Object.keys(codes)) {
    if (!ERROR_CODE.test(name) || name.length > 40) context.addIssue({ code: "custom", path: [name], message: "must be an upper-case code of at most 40 characters, such as SKILLS_INVALID" });
    else if (ERROR_CODES.includes(name)) context.addIssue({ code: "custom", path: [name], message: "is in the contract's error table already, so the plugin does not declare it" });
  }
}).describe("The plugin's own error codes, beyond the contract's table (\xA712). Absent: the plugin uses only the contract's.");
function jsonSchemaProblems(schema, what) {
  if (!plain(schema)) return [`${what} must be a JSON Schema object`];
  try {
    fromJSONSchema(schema);
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : "it cannot be read";
    return [`${what} must be a JSON Schema 2020-12 object: ${reason}`];
  }
  return [];
}
function optionProblems(schema) {
  if (!plain(schema)) return [{ path: [], message: "options must be a JSON Schema object" }];
  if (schema["type"] !== "object") return [{ path: ["type"], message: 'options must be a JSON Schema object, with "type": "object"' }];
  const properties = schema["properties"];
  if (!plain(properties)) return [{ path: ["properties"], message: "must be a JSON Schema object with properties, including access" }];
  const problems = [];
  if (!Object.hasOwn(properties, "access")) problems.push({ path: ["properties", "access"], message: "the options schema must include access" });
  else if (!plain(properties["access"]) && typeof properties["access"] !== "boolean") problems.push({ path: ["properties", "access"], message: "must be a JSON Schema object" });
  for (const key of ["access", "accounts", "allowUntestedHost"]) {
    const property = properties[key];
    if (property !== void 0 && !plain(property) && typeof property !== "boolean") problems.push({ path: ["properties", key], message: "must be a JSON Schema object" });
  }
  if (problems.length > 0) return problems;
  try {
    fromJSONSchema(schema);
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : "it cannot be read";
    problems.push({ path: [], message: `options must be a JSON Schema 2020-12 object: ${reason}` });
  }
  return problems;
}
var versionField = literal(MANIFEST_VERSION);
var optionsField = record(string(), unknown()).describe("JSON Schema 2020-12 of the plugin's options. It must include access.");
var normalizedMCPTool = (tool) => tool.replace(/[^A-Za-z0-9_-]/g, "_").toLowerCase();
var guestToolsField = array(string().regex(METHOD_NAME, { error: "must be a tool name such as done" })).max(64).describe("Tools a plugin's helper adds on another machine, such as the guest's done tool. They are names for T0, not methods this plugin registers.");
var methodsField = record(methodName, methodItem).superRefine((methods, context) => {
  const wildcard = methods["mcp:*"];
  for (const field of ["description", "input"]) {
    if (wildcard?.[field] === void 0) continue;
    context.addIssue({
      code: "custom",
      path: ["mcp:*", field],
      message: `mcp:* is a wildcard and has no one tool, so it cannot carry a ${field === "description" ? "description" : "input schema"}; put it on an mcp:<tool> row`
    });
  }
  const groups = /* @__PURE__ */ new Map();
  for (const name of Object.keys(methods)) {
    if (!name.startsWith("mcp:") || name === "mcp:*") continue;
    const tool = name.slice("mcp:".length);
    const effective = normalizedMCPTool(tool);
    const group = groups.get(effective);
    if (group === void 0) groups.set(effective, [name]);
    else group.push(name);
  }
  for (const [effective, names] of groups) {
    if (names.length < 2) continue;
    for (const name of names) {
      context.addIssue({
        code: "custom",
        path: [name],
        message: `collides with ${names.filter((other) => other !== name).join(", ")}: OpenCode's tool action is ${effective} (punctuation becomes _, and Windows matches case-insensitively)`
      });
    }
  }
}).describe("Every callable, including pass-through MCP tools.");
var sourcesField = array(source);
var actionsField = array(action);
var eventsField = events;
var FIELDS = {
  version: { schema: versionField, required: true },
  plugin: { schema: plugin, required: true },
  accounts: { schema: accountsInfo, required: false },
  options: { schema: optionsField, required: true },
  methods: { schema: methodsField, required: true },
  guestTools: { schema: guestToolsField, required: false },
  sources: { schema: sourcesField, required: true },
  actions: { schema: actionsField, required: true },
  events: { schema: eventsField, required: true },
  errors: { schema: errorsField, required: false }
};
var top = looseObject({
  version: versionField,
  plugin,
  accounts: accountsInfo.optional(),
  options: optionsField,
  methods: methodsField,
  guestTools: guestToolsField.optional(),
  sources: sourcesField,
  actions: actionsField,
  events: eventsField,
  errors: errorsField.optional()
});
var asObject = (value) => plain(value) ? value : void 0;
var objectRecord = (value) => asObject(value) ?? {};
var objectList = (value) => Array.isArray(value) ? value.filter(plain) : [];
function crossProblems(value, parsed) {
  const problems = [];
  const issue = (path, message) => problems.push(`capabilities${pathText(path)}: ${message}`);
  const plugin2 = asObject(parsed["plugin"]) ?? asObject(value["plugin"]);
  const name = typeof plugin2?.["name"] === "string" ? plugin2["name"] : void 0;
  const accounts = asObject(parsed["accounts"]) ?? asObject(value["accounts"]);
  const methods = objectRecord(parsed["methods"] ?? value["methods"]);
  if (!Object.hasOwn(methods, "status")) issue(["methods", "status"], "every plugin declares status");
  if (accounts !== void 0 && !Object.hasOwn(methods, "probe")) issue(["methods", "probe"], "a plugin with accounts declares probe");
  if (value["options"] !== void 0) for (const problem of optionProblems(value["options"])) issue(["options", ...problem.path], problem.message);
  if (accounts !== void 0) {
    const options = asObject(value["options"]);
    const properties = options === void 0 ? void 0 : asObject(options["properties"]);
    if (properties === void 0) issue(["options", "properties", "accounts"], "an account-taking plugin declares accounts in its options schema");
    else if (!Object.hasOwn(properties, "accounts")) issue(["options", "properties", "accounts"], "an account-taking plugin declares accounts in its options schema");
    else {
      const accountSchema = asObject(properties["accounts"]);
      if (accountSchema === void 0 || !plain(accountSchema["additionalProperties"])) {
        issue(["options", "properties", "accounts", "additionalProperties"], "must define the profile schema every alias is checked against");
      }
    }
    const profile = asObject(accounts["profile"]);
    if (profile !== void 0 && profile["$ref"] !== PROFILE_REF) issue(["accounts", "profile", "$ref"], `must be "${PROFILE_REF}"`);
  }
  let pinned = 0;
  for (const [methodNameValue, item] of Object.entries(methods)) {
    const record2 = objectRecord(item);
    if (record2["pinned"] === true) pinned++;
    if (record2["input"] !== void 0) for (const problem of jsonSchemaProblems(record2["input"], "input")) issue(["methods", methodNameValue, "input"], problem.replace(/^input: /, ""));
    const commits = record2["commits"];
    if (typeof commits === "string") {
      const target = methods[commits];
      if (target === void 0) issue(["methods", methodNameValue, "commits"], `"${commits}" is not a declared method`);
      else if (objectRecord(target)["plans"] !== true) issue(["methods", methodNameValue, "commits"], `"${commits}" does not declare plans: true`);
      if (commits === methodNameValue) issue(["methods", methodNameValue, "commits"], "a method cannot commit itself");
    }
    const named = methodNameValue.startsWith("mcp:") ? methodNameValue.slice(4) : methodNameValue;
    if (named !== "*") {
      if (/^(?:delete|remove)_/.test(named) && record2["class"] !== "delete") issue(["methods", methodNameValue, "class"], "a delete_* or remove_* method must be class delete");
      if (/^(?:send|post)_/.test(named) && record2["class"] !== "send") issue(["methods", methodNameValue, "class"], "a send_* or post_* method must be class send");
      if (/^share_/.test(named) && record2["class"] !== "share") issue(["methods", methodNameValue, "class"], "a share_* method must be class share");
    }
  }
  if (pinned > 1) issue(["methods"], "at most one method may be pinned");
  const guestTools = Array.isArray(parsed["guestTools"]) ? parsed["guestTools"] : [];
  const seenGuestTools = /* @__PURE__ */ new Set();
  for (const [index, tool] of guestTools.entries()) {
    if (typeof tool !== "string") continue;
    if (seenGuestTools.has(tool)) issue(["guestTools", index], `"${tool}" is declared twice`);
    seenGuestTools.add(tool);
    if (Object.hasOwn(methods, tool)) issue(["guestTools", index], `"${tool}" is also a declared method; a guest tool is not a host method`);
  }
  const sourceIds = /* @__PURE__ */ new Set();
  const serviceLabels = /* @__PURE__ */ new Map();
  for (const [index, item] of objectList(value["sources"]).entries()) {
    const id = item["id"];
    if (typeof id === "string") {
      if (name !== void 0 && id.split(".")[0] !== name) issue(["sources", index, "id"], `must begin with the plugin's name "${name}"`);
      if (sourceIds.has(id)) issue(["sources", index, "id"], `"${id}" is declared twice`);
      sourceIds.add(id);
    }
    const method = item["method"];
    if (typeof method === "string" && methods[method] === void 0) issue(["sources", index, "method"], `"${method}" is not a declared method`);
    const kind = item["kind"];
    if (kind === "events") {
      const reads = item["reads"];
      if (typeof reads === "string" && name !== void 0 && !isEventKindIn(reads, name)) issue(["sources", index, "reads"], `must be one of ${EVENT_KINDS.join(", ")}, or x-${name}/<kind>`);
    } else if (kind === "snapshot") {
      const output = item["output"];
      if (typeof output === "string") {
        if (!isOutputName(output) && !isExtensionOutput(output)) issue(["sources", index, "output"], `"${output}" is not a registered output and not an x-<namespace>/<name>`);
        else if (isExtensionOutput(output) && name !== void 0 && !output.startsWith(`x-${name}/`)) issue(["sources", index, "output"], `an extension output must be in the plugin's namespace, x-${name}/<name>`);
      }
    }
    const service2 = asObject(item["service"]);
    if (service2 !== void 0 && typeof service2["id"] === "string" && typeof service2["label"] === "string") {
      const seen = serviceLabels.get(service2["id"]);
      if (seen !== void 0 && seen !== service2["label"]) issue(["sources", index, "service", "label"], `is "${service2["label"]}", and ${service2["id"]} says "${seen}" everywhere else`);
      else serviceLabels.set(service2["id"], service2["label"]);
    }
    const scope2 = asObject(item["scope"]);
    const suggest = scope2 === void 0 ? void 0 : asObject(scope2["suggest"]);
    const suggested = suggest?.["method"];
    if (typeof suggested === "string" && methods[suggested] === void 0) issue(["sources", index, "scope", "suggest", "method"], `"${suggested}" is not a declared method`);
    for (const [detailIndex, entry] of objectList(item["details"]).entries()) {
      const detailMethod = entry["method"];
      if (typeof detailMethod === "string" && methods[detailMethod] === void 0) issue(["sources", index, "details", detailIndex, "method"], `"${detailMethod}" is not a declared method`);
    }
  }
  const actionIds = /* @__PURE__ */ new Set();
  for (const [index, item] of objectList(value["actions"]).entries()) {
    const id = item["id"];
    if (typeof id === "string") {
      if (name !== void 0 && id.split(".")[0] !== name) issue(["actions", index, "id"], `must begin with the plugin's name "${name}"`);
      if (actionIds.has(id)) issue(["actions", index, "id"], `"${id}" is declared twice`);
      actionIds.add(id);
    }
    const preview = item["preview"];
    const commit = item["commit"];
    if (typeof preview === "string" && preview === commit) issue(["actions", index, "commit"], "the commit must be a different method from the preview");
    if (typeof preview === "string" && methods[preview] === void 0) issue(["actions", index, "preview"], `"${preview}" is not a declared method`);
    if (typeof commit === "string" && methods[commit] === void 0) issue(["actions", index, "commit"], `"${commit}" is not a declared method`);
    if (item["input"] !== void 0) for (const problem of jsonSchemaProblems(item["input"], "input")) issue(["actions", index, "input"], problem.replace(/^input: /, ""));
    if (item["output"] !== void 0) for (const problem of jsonSchemaProblems(item["output"], "output")) issue(["actions", index, "output"], problem.replace(/^output: /, ""));
  }
  return problems;
}
function pathText(path) {
  return path.map((part) => typeof part === "number" ? `[${part}]` : `.${String(part)}`).join("");
}
function problemsOf(error) {
  const problems = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) problems.push(`capabilities${pathText([...issue.path, key])}: is not a key the manifest defines; app-only hints use x-<app>`);
      continue;
    }
    problems.push(`capabilities${pathText(issue.path)}: ${issue.message}`);
  }
  return problems;
}
function checkManifest(value) {
  if (!plain(value)) return { ok: false, problems: ["capabilities: must be an object"] };
  const problems = [];
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(FIELDS, key) && !EXTENSION_KEY.test(key)) {
      problems.push(`capabilities.${key}: is not a key the manifest defines; app-only hints use x-<app>`);
    }
  }
  const parsed = {};
  for (const key of Object.keys(value)) if (EXTENSION_KEY.test(key)) parsed[key] = value[key];
  for (const [key, field] of Object.entries(FIELDS)) {
    const raw = value[key];
    if (raw === void 0) {
      if (field.required) problems.push(`capabilities.${key}: Required`);
      continue;
    }
    const result = field.schema.safeParse(raw);
    if (result.success) parsed[key] = result.data;
    else problems.push(...problemsOf(result.error).map((problem) => `capabilities.${key}${problem.slice("capabilities".length)}`));
  }
  problems.push(...crossProblems(value, parsed));
  return problems.length === 0 ? { ok: true, value: parsed } : { ok: false, problems };
}
function manifestProblems(value) {
  const checked = checkManifest(value);
  return checked.ok ? [] : checked.problems;
}
var MANIFEST_SCHEMA = {
  name: "capabilities",
  check: checkManifest,
  parse(value) {
    const checked = checkManifest(value);
    if (checked.ok) return checked.value;
    throw new Error(`capabilities: the manifest breaks the schema:
- ${checked.problems.join("\n- ")}`);
  },
  jsonSchema() {
    const generated = toJSONSchema(top, { target: "draft-2020-12", unrepresentable: "any" });
    return {
      ...generated,
      additionalProperties: false,
      patternProperties: { "^x-[a-z][a-z0-9-]*$": {} }
    };
  }
};
function readInstalledManifest(directory, options = {}) {
  const file = join(directory, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error.code === "ENOENT" ? "there is no package.json there" : "its package.json is not JSON";
    return { ok: false, problems: [`no manifest at ${directory}: ${reason}`] };
  }
  if (!plain(pkg)) return { ok: false, problems: [`no manifest at ${directory}: its package.json is not an object`] };
  const { name, version, capabilities } = pkg;
  if (typeof name !== "string" || typeof version !== "string") return { ok: false, problems: [`no manifest at ${directory}: its package.json has no name and version`] };
  if (options.version !== void 0 && options.version !== version) {
    return { ok: false, problems: [`${name} at ${directory} is version ${version}, not the ${options.version} the install names`] };
  }
  if (capabilities === void 0) return { ok: false, problems: [`${name} ${version} declares no manifest (no top-level "capabilities" key)`] };
  const checked = checkManifest(capabilities);
  if (!checked.ok) return { ok: false, problems: checked.problems.map((problem) => `${name} ${version}: ${problem}`) };
  return { ok: true, value: { package: name, version, directory, manifest: checked.value, hash: manifestHash(capabilities) } };
}
function findInstalledPackage(name, from) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) return void 0;
  let directory = from;
  for (; ; ) {
    const candidate = join(directory, "node_modules", ...name.split("/"));
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return void 0;
    directory = parent;
  }
}
function findSource(manifest, id) {
  return manifest.sources.find((source2) => source2.id === id);
}
function findAction(manifest, id) {
  return manifest.actions.find((action2) => action2.id === id);
}
function findMethod(manifest, name) {
  return manifest.methods[name];
}
function methodAccounts(method) {
  return method.accounts ?? "none";
}
function maxBytesOf(source2) {
  return source2.maxBytes ?? MAX_BYTES_DEFAULT;
}

export {
  canonicalJson,
  manifestHash,
  checkManifest,
  manifestProblems,
  MANIFEST_SCHEMA,
  readInstalledManifest,
  findInstalledPackage,
  findSource,
  findAction,
  findMethod,
  methodAccounts,
  maxBytesOf
};
