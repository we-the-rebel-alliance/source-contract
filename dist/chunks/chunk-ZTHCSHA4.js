// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  validator
} from "./chunk-P2QQJNQB.js";
import {
  secretKinds
} from "./chunk-M7EFVHR5.js";
import {
  ALIAS_PATTERN
} from "./chunk-CCSPDV3H.js";
import {
  _enum,
  object,
  string
} from "./chunk-AYJEC7Y2.js";

// src/bus/definition.ts
var BUS_EVENTS = ["changed", "status", "account"];
var BUS_STATES = ["ready", "needs_sign_in", "error"];
var REASON_MAX = 160;
var PLUGIN_NAME = /^[a-z0-9]{1,31}$/;
function isPluginName(value) {
  return typeof value === "string" && PLUGIN_NAME.test(value);
}
function assertPluginName(name) {
  if (isPluginName(name)) return;
  const shown = typeof name === "string" ? `"${name}"` : typeof name;
  throw new Error(`bus: ${shown} is not a plugin name. Next step: use 1 to 31 lowercase letters or digits, with no hyphen (contract \xA73).`);
}
var CAPABILITY_SEGMENT = "[a-z][a-z0-9-]*";
function capabilityPattern(name) {
  return `^${name}\\.${CAPABILITY_SEGMENT}(?:\\.${CAPABILITY_SEGMENT})*$`;
}

// src/bus/data.ts
function serialise(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return void 0;
  }
}
function holdsSecret(text) {
  return secretKinds(text).length > 0;
}

// src/bus/schema.ts
var ACCOUNT = ALIAS_PATTERN;
var ONE_LINE_RE = /^[^\r\n]+$/;
var ACCOUNT_EXPECTATION = "must be an account alias: lowercase letters and digits, starting with a letter (contract \xA75)";
function validatorsFor(name) {
  const capability = new RegExp(capabilityPattern(name));
  const changed = object({
    capability: string().refine((value) => capability.test(value), { error: `must be this plugin's capability id, ${name}.<capability>` }),
    account: string().min(1).max(32).refine((value) => ACCOUNT.test(value), { error: ACCOUNT_EXPECTATION }),
    reason: string().min(1, { error: "must not be empty" }).max(REASON_MAX, { error: `must be at most ${REASON_MAX} characters` }).refine((value) => ONE_LINE_RE.test(value), { error: `must be 1 to ${REASON_MAX} characters on one line` })
  }).strict();
  const status = object({ state: _enum([...BUS_STATES]) }).strict();
  const account = object({ account: string().min(1).max(32).refine((value) => ACCOUNT.test(value), { error: ACCOUNT_EXPECTATION }), state: _enum([...BUS_STATES]) }).strict();
  return {
    changed: validator("bus.changed", changed),
    status: validator("bus.status", status),
    account: validator("bus.account", account)
  };
}
var cache = /* @__PURE__ */ new Map();
function busValidators(name) {
  assertPluginName(name);
  const existing = cache.get(name);
  if (existing !== void 0) return existing;
  const built = validatorsFor(name);
  cache.set(name, built);
  return built;
}
function schemaOf(validator2) {
  const schema = validator2.jsonSchema();
  if (schema["type"] !== "object" || schema["additionalProperties"] !== false) {
    throw new Error("bus: an event schema must be a closed object");
  }
  return schema;
}
function busEvents(name) {
  const validators = busValidators(name);
  return {
    changed: { schema: schemaOf(validators.changed) },
    status: { schema: schemaOf(validators.status) },
    account: { schema: schemaOf(validators.account) }
  };
}
function checkBusData(name, event, value) {
  if (!BUS_EVENTS.includes(event)) {
    return { ok: false, problems: ["event: must be one of changed, status, account"] };
  }
  const checked = busValidators(name)[event].check(value);
  return checked.ok ? { ok: true, value: checked.value } : checked;
}

// src/bus/reader.ts
function busEventType(name, event) {
  return `rpc.${name}.${event}`;
}
var RPC_TYPE = /^rpc\.([a-z0-9]{1,31})\.([a-z0-9_]+)$/;
function readBusEvent(payload, options) {
  assertPluginName(options.name);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return { ok: false, reason: "not-a-bus-event", problems: [] };
  const record = payload;
  const type = record["type"];
  if (typeof type !== "string") return { ok: false, reason: "not-a-bus-event", problems: [] };
  const match = RPC_TYPE.exec(type);
  if (match === null) return { ok: false, reason: "not-a-bus-event", problems: [] };
  const name = match[1];
  const event = match[2];
  if (name !== options.name) return { ok: false, reason: "unknown-plugin", problems: [] };
  if (!BUS_EVENTS.includes(event)) return { ok: false, reason: "unknown-event", problems: [] };
  const text = serialise(record["data"]);
  if (text !== void 0 && holdsSecret(text)) return { ok: false, reason: "secret", problems: [] };
  const data = checkBusData(name, event, record["data"]);
  if (!data.ok) return { ok: false, reason: "invalid", problems: data.problems };
  return { ok: true, event: { type, name, event, data: data.value } };
}

export {
  BUS_EVENTS,
  BUS_STATES,
  REASON_MAX,
  isPluginName,
  assertPluginName,
  capabilityPattern,
  serialise,
  holdsSecret,
  busEvents,
  checkBusData,
  busEventType,
  readBusEvent
};
