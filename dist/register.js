// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  BUS_EVENTS,
  assertPluginName,
  busEvents,
  checkBusData,
  holdsSecret,
  serialise
} from "./chunks/chunk-ZTHCSHA4.js";
import {
  verifyGrant
} from "./chunks/chunk-EGSVFMLE.js";
import "./chunks/chunk-UP4MI2EO.js";
import {
  applyAccess,
  evaluate,
  methodAction,
  unguardedAgents
} from "./chunks/chunk-AMT4OSAU.js";
import {
  manifestHash
} from "./chunks/chunk-YOSR7DZV.js";
import "./chunks/chunk-UY2FWVSQ.js";
import {
  MAX_BYTES_DEFAULT,
  errorCodeOf,
  hostInRange
} from "./chunks/chunk-RUQH3YH7.js";
import "./chunks/chunk-7KJXMIQH.js";
import {
  problemsOf
} from "./chunks/chunk-P2QQJNQB.js";
import "./chunks/chunk-M7EFVHR5.js";
import {
  DEFAULT_ALIAS,
  accountsOf,
  redactReason,
  resolveAccount
} from "./chunks/chunk-CCSPDV3H.js";
import {
  array,
  fromJSONSchema,
  literal,
  looseObject,
  strictObject,
  string,
  unknown
} from "./chunks/chunk-AYJEC7Y2.js";
import "./chunks/chunk-WLRWVIVP.js";

// src/register/rpc.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// src/register/errors.ts
var RegisterError = class extends Error {
  refusal;
  constructor(refusal2) {
    super(refusal2.message);
    this.name = "RegisterError";
    this.refusal = refusal2;
  }
};
function refusal(code, what, next) {
  const clean = what.replace(/[.\s]+$/, "");
  return { code, what: clean, next, message: `${code}: ${clean}. Next step: ${next}` };
}
function refuse(code, what, next) {
  throw new RegisterError(refusal(code, what, next));
}
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function refusalOf(error) {
  if (error instanceof RegisterError) return error.refusal;
  if (!plain(error) && !(error instanceof Error)) return void 0;
  const record = error;
  const data = plain(record["data"]) ? record["data"] : {};
  const message = typeof record["message"] === "string" ? record["message"] : String(error);
  const raw = [record["code"], data["code"], /^([A-Z][A-Z0-9_]*):/.exec(message)?.[1]].find((code2) => typeof code2 === "string");
  if (raw === void 0) return void 0;
  const code = errorCodeOf(raw);
  if (code === void 0) return void 0;
  const next = typeof record["next"] === "string" ? record["next"] : typeof data["next"] === "string" ? data["next"] : void 0;
  const fromMessage = /^[A-Z][A-Z0-9_]*:\s*([^]*?)(?:\.\s*Next step:\s*([^]*))?$/.exec(message.split(/\r?\n/, 1)[0] ?? "");
  const what = typeof record["what"] === "string" ? record["what"] : fromMessage?.[1] ?? message.replace(/^[A-Z][A-Z0-9_]*:\s*/, "");
  const step = next ?? fromMessage?.[2];
  if (step === void 0 || step.trim() === "") return void 0;
  return refusal(code, redactReason(what), redactReason(step));
}
function permissionRefusal(error, what) {
  const own = refusalOf(error);
  if (own) return own;
  const message = (error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : String(error)) ?? String(error);
  return refusal("PERMISSION_DENIED", `${what} was refused: ${redactReason(message)}`, "Ask the person to allow it, or use a session whose agent allows it.");
}
function reasonOf(error) {
  return redactReason(error instanceof Error ? error.message : String(error));
}

// src/register/assertions.ts
async function rejectPendingAsk(context, call) {
  const list = context.permission.list;
  const reply = context.permission.reply;
  if (list === void 0 || reply === void 0) return;
  try {
    const pending = await list({ sessionID: call.sessionID });
    const ask = pending.find((request) => request.source?.id === call.id);
    if (ask !== void 0) await reply({ sessionID: call.sessionID, requestID: ask.id, decision: "reject", message: "The call was cancelled." });
  } catch {
  }
}
function resourcesFor(entry, account) {
  const operations = entry.item.operations ?? [];
  return operations.length === 0 ? [`${account}:*`] : operations.map((operation) => `${account}:${operation}`);
}
function callEffect(name, entry, account, rules) {
  const action = methodAction(name, entry.name);
  let effect = evaluate(rules, action, "*");
  for (const resource of resourcesFor(entry, account)) {
    const found = evaluate(rules, action, resource);
    if (found === "deny") return "deny";
    if (found === "ask") effect = "ask";
  }
  return effect;
}
async function gate(context, name, entry, call, account, options) {
  const cancelled = () => new RegisterError(refusal("UNAVAILABLE", "the call was cancelled while its permission ask was pending", "Retry the call."));
  const signal = call.signal;
  if (signal?.aborted) throw cancelled();
  const pending = context.permission.assert({
    sessionID: call.sessionID,
    ...call.agent === void 0 ? {} : { agent: call.agent },
    action: methodAction(name, entry.name),
    resources: resourcesFor(entry, account),
    // Save only this method's own action for this account. Never `*`, which would be a project-wide allow.
    ...options.save ? { save: [`${account}:*`] } : {},
    ...options.source === void 0 ? {} : { source: options.source }
  });
  pending.catch(() => void 0);
  if (signal === void 0) {
    await pending;
    return;
  }
  let onAbort;
  try {
    await Promise.race([
      pending,
      new Promise((_, reject) => {
        onAbort = () => reject(cancelled());
        signal.addEventListener("abort", onAbort, { once: true });
      })
    ]);
  } catch (error) {
    if (signal.aborted) await rejectPendingAsk(context, call);
    throw error;
  } finally {
    if (onAbort !== void 0) signal.removeEventListener("abort", onAbort);
  }
}

// src/register/plans.ts
import { randomBytes, randomUUID } from "node:crypto";
var PLAN_TTL_MS = 15 * 6e4;
var PLAN_ID_BYTES = 16;
var PLAN_MAX_BYTES = MAX_BYTES_DEFAULT;
function mintPlanId() {
  return randomBytes(PLAN_ID_BYTES).toString("base64url");
}
function planStore(options = {}) {
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? PLAN_TTL_MS;
  const mint = options.mint ?? mintPlanId;
  const plans = /* @__PURE__ */ new Map();
  const prune = () => {
    const at = now();
    for (const [id, plan] of plans) if (plan.expires <= at) plans.delete(id);
  };
  const same = (plan, reservation) => plan.reserved === reservation.token && !plan.used;
  return {
    record(answer, account, method) {
      prune();
      let stored;
      let text;
      try {
        stored = structuredClone(answer);
        text = JSON.stringify(stored);
      } catch {
        return { ok: false, code: "PLAN_INVALID", problems: ["the plan holds a value a copy cannot carry; a plan answer is plain JSON"] };
      }
      if (text === void 0) return { ok: false, code: "PLAN_INVALID", problems: ["the plan is not JSON; a plan answer is a JSON object"] };
      const bytes = Buffer.byteLength(text);
      if (bytes > PLAN_MAX_BYTES) {
        return { ok: false, code: "PLAN_INVALID", problems: [`the plan is ${bytes} bytes of JSON, over the ${PLAN_MAX_BYTES}-byte limit`] };
      }
      let planId = mint();
      while (plans.has(planId)) planId = mint();
      plans.set(planId, { account, method, answer: stored, expires: now() + ttl, reserved: void 0, used: false });
      return { ok: true, planId };
    },
    reserve(planId, method) {
      prune();
      const plan = plans.get(planId);
      if (plan === void 0) return { ok: false, code: "PLAN_INVALID", problems: [`there is no plan '${planId}'; plan again and commit with the planId it answers`] };
      if (plan.used || plan.reserved !== void 0) return { ok: false, code: "PLAN_USED", problems: [`the plan '${planId}' is already reserved or used; plan again to make a new one`] };
      if (plan.method !== method) return { ok: false, code: "PLAN_INVALID", problems: [`the plan '${planId}' commits ${plan.method}, not ${method}`] };
      const reservation = { planId, method, account: plan.account, answer: plan.answer, token: randomUUID() };
      plan.reserved = reservation.token;
      return { ok: true, reservation };
    },
    release(reservation) {
      const plan = plans.get(reservation.planId);
      if (plan !== void 0 && same(plan, reservation)) plan.reserved = void 0;
    },
    consume(reservation) {
      const plan = plans.get(reservation.planId);
      if (plan === void 0) {
        prune();
        return { ok: false, code: "PLAN_INVALID", problems: [`there is no plan '${reservation.planId}'; plan again and commit with the new planId`] };
      }
      if (plan.expires <= now()) {
        plans.delete(reservation.planId);
        return { ok: false, code: "PLAN_INVALID", problems: [`the plan '${reservation.planId}' expired before its handler started; plan again`] };
      }
      prune();
      if (plan.used) return { ok: false, code: "PLAN_USED", problems: [`the plan '${reservation.planId}' was already used; plan again`] };
      if (plan.reserved !== reservation.token) return { ok: false, code: "PLAN_USED", problems: [`the plan '${reservation.planId}' is no longer reserved by this call; plan again`] };
      plan.used = true;
      plan.reserved = void 0;
      return { ok: true, account: plan.account, answer: plan.answer };
    },
    get size() {
      prune();
      return plans.size;
    }
  };
}

// src/register/validate.ts
var PLAN_OUTPUT = {
  type: "object",
  properties: {
    planId: { type: "string", minLength: 1 },
    method: { type: "string", minLength: 1 },
    output: {},
    reaches: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: { id: { type: "string", minLength: 1, maxLength: 320 }, label: { type: "string", maxLength: 200 } },
        required: ["id"],
        additionalProperties: false
      }
    },
    changes: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 500 } },
    cost: {},
    trust: { type: "string", enum: ["untrusted"] }
  },
  required: ["planId", "method"],
  additionalProperties: false
};
var COMMIT_INPUT = {
  type: "object",
  properties: { planId: { type: "string", minLength: 1 } },
  required: ["planId"],
  additionalProperties: false
};
var reach = strictObject({ id: string().min(1).max(320), label: string().max(200).optional() });
var planAnswer = looseObject({
  method: string().min(1),
  output: unknown().optional(),
  reaches: array(reach).max(20).optional(),
  changes: array(string().min(1).max(500)).max(20).optional(),
  cost: unknown().optional(),
  trust: literal("untrusted").optional()
});
var commit = strictObject({ planId: string().min(1) });
var plain2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function codecOf(schema) {
  try {
    return { ok: true, codec: fromJSONSchema(schema) };
  } catch (error) {
    return { ok: false, problem: error instanceof Error ? error.message : String(error) };
  }
}
function inputSchemaProblems(schema) {
  if (!plain2(schema)) return ["the input schema must be an object"];
  if (schema["type"] !== "object") return ['the input schema must have type: "object"'];
  const codec = codecOf(schema);
  return codec.ok ? [] : [`the input schema is not a JSON Schema this package can check: ${codec.problem}`];
}
function outputSchemaProblems(schema) {
  if (!plain2(schema)) return ["the output schema must be an object"];
  const codec = codecOf(schema);
  return codec.ok ? [] : [`the output schema is not a JSON Schema this package can check: ${codec.problem}`];
}
function validate(schema, value) {
  const codec = codecOf(schema);
  if (!codec.ok) return { ok: false, problems: [`the schema is not a JSON Schema this package can check: ${codec.problem}`] };
  const result = codec.codec.safeParse(value);
  return result.success ? { ok: true, value: result.data } : { ok: false, problems: problemsOf(result.error) };
}
function validatePlanAnswer(value) {
  if (plain2(value) && Object.hasOwn(value, "planId")) {
    return { ok: false, problems: ["a plan handler must not answer a planId; the register mints it and adds it to the plan"] };
  }
  const result = planAnswer.safeParse(value);
  return result.success ? { ok: true, value: result.data } : { ok: false, problems: problemsOf(result.error) };
}
function validateCommitInput(value) {
  const result = commit.safeParse(value);
  return result.success ? { ok: true, value: result.data } : { ok: false, problems: problemsOf(result.error) };
}
function toolInputSchema(item, handlerInput) {
  if (item.commits !== void 0) return COMMIT_INPUT;
  const base = handlerInput;
  const properties = plain2(base["properties"]) ? { ...base["properties"] } : {};
  const required = Array.isArray(base["required"]) ? [...base["required"]] : [];
  const declaresAccount = Object.hasOwn(properties, "account") || required.includes("account");
  if (item.accounts === "optional") {
    if (declaresAccount) throw new Error("register: a method with accounts: optional gets account from the register; remove it from the handler's input schema");
    properties["account"] = { type: "string", description: "The account alias, such as work; omit it when the plugin has one account." };
  } else if (declaresAccount) {
    throw new Error("register: a method with accounts: none cannot take an account; remove account from the handler's input schema");
  }
  return { ...base, type: "object", properties, ...required.length === 0 ? {} : { required } };
}

// src/register/handlers.ts
function methodEntries(manifest, handlers) {
  const entries = [];
  for (const [name, item] of Object.entries(manifest.methods)) {
    if (name.startsWith("mcp:")) {
      if (Object.hasOwn(handlers, name)) {
        refuse("OPTIONS_INVALID", `${manifest.plugin.name} declares ${name} as a pass-through MCP method but gives it a handler`, "Leave pass-through MCP tools to the MCP server; register only the plugin's own methods.");
      }
      continue;
    }
    const handler = handlers[name];
    if (handler === void 0) {
      refuse("UNAVAILABLE", `${manifest.plugin.name}.${name} is declared but has no handler`, `Add the ${name} handler to register's handler table, or remove ${name} from the manifest's methods.`);
    }
    const commit2 = item.plans === true ? Object.entries(manifest.methods).filter(([, held]) => held.commits === name).map(([held]) => held) : [];
    if (item.plans === true && commit2.length !== 1) {
      refuse("OPTIONS_INVALID", `${manifest.plugin.name}.${name} is a plan but ${commit2.length === 0 ? "no method commits it" : "more than one method commits it"}`, "Declare exactly one method with commits naming this plan.");
    }
    entries.push({ name, item, handler, ...shapes(manifest.plugin.name, name, item, handler), ...commit2.length === 1 ? { commit: commit2[0] } : {} });
  }
  for (const name of Object.keys(handlers)) {
    if (!Object.hasOwn(manifest.methods, name)) {
      refuse("UNAVAILABLE", `${manifest.plugin.name} has a handler for ${name}, which the manifest does not declare`, `Declare ${name} in the manifest's methods, or remove its handler.`);
    }
  }
  return entries;
}
function shapes(name, method, item, handler) {
  const inputProblems = item.commits === void 0 ? inputSchemaProblems(handler.input) : [];
  if (inputProblems.length > 0) {
    refuse("OPTIONS_INVALID", `${name}.${method}'s input schema is not usable: ${inputProblems.join("; ")}`, "Give the handler a JSON Schema object for its input.");
  }
  const outputProblems = outputSchemaProblems(handler.output);
  if (outputProblems.length > 0) {
    refuse("OPTIONS_INVALID", `${name}.${method}'s output schema is not usable: ${outputProblems.join("; ")}`, "Give the handler a JSON Schema object for its answer.");
  }
  try {
    return { input: toolInputSchema(item, handler.input), output: item.plans === true ? PLAN_OUTPUT : handler.output };
  } catch (error) {
    refuse("OPTIONS_INVALID", `${name}.${method}: ${error instanceof Error ? error.message : String(error)}`, "Fix the handler's schema.");
  }
}

// src/register/invoke.ts
var plain3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function prepare(manifest, handlers, accounts, access, agents) {
  return { name: manifest.plugin.name, manifest, hash: manifestHash(manifest), entries: methodEntries(manifest, handlers), accounts, plans: planStore(), access, agents };
}
function checkedInput(entry, raw) {
  if (!plain3(raw)) refuse("INPUT_INVALID", `${entry.name} takes an object as its input`, "Pass the input its schema describes.");
  const input = { ...raw };
  const account = input["account"];
  if (entry.item.commits !== void 0) {
    if (Object.hasOwn(input, "account")) {
      throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} commits a plan and takes only { planId }; the grant names the account`, "Remove account from the commit input."));
    }
    const checked2 = validateCommitInput(input);
    if (!checked2.ok) throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} commits a plan and takes only { planId }: ${checked2.problems.join("; ")}`, "Call the planning method, then pass the planId it answers."));
    return { input: checked2.value, account: void 0 };
  }
  if (Object.hasOwn(input, "account")) {
    if (entry.item.accounts !== "optional") refuse("INPUT_INVALID", `${entry.name} takes no account`, "Remove account from the input; only a method declared accounts: optional takes one.");
    delete input["account"];
  }
  const checked = validate(entry.input, input);
  if (!checked.ok) throw new RegisterError(refusal("INPUT_INVALID", `${entry.name}'s input breaks its schema: ${checked.problems.join("; ")}`, "Pass only the input the method's schema describes."));
  return { input: checked.value, account };
}
function prepareCall(entry, raw, accounts, plans) {
  const { input, account } = checkedInput(entry, raw);
  if (entry.item.commits !== void 0) {
    const planId = typeof input["planId"] === "string" ? input["planId"] : "";
    const plan = plans.reserve(planId, entry.name);
    if (!plan.ok) throw new RegisterError(refusal(plan.code, plan.problems.join("; "), "Plan again, then commit with the planId it answers."));
    try {
      const resolved2 = accounts.length === 0 ? { ok: true, alias: plan.reservation.account } : resolveAccount(accounts, { account: plan.reservation.account });
      if (!resolved2.ok) throw new RegisterError(refusal("ACCOUNT_UNKNOWN", resolved2.what, resolved2.next));
      return { input, account: resolved2.alias, reservation: plan.reservation, plan: plan.reservation.answer };
    } catch (error) {
      plans.release(plan.reservation);
      throw error;
    }
  }
  const resolved = entry.item.accounts === "optional" ? resolveAccount(accounts, { account }) : { ok: true, alias: DEFAULT_ALIAS };
  if (!resolved.ok) throw new RegisterError(refusal(resolved.code, resolved.what, resolved.next));
  return { input, account: resolved.alias };
}
function checkedOutput(entry, value) {
  if (entry.item.plans === true) {
    const plan = validatePlanAnswer(value);
    if (!plan.ok) {
      throw new RegisterError(
        refusal("PLAN_INVALID", `${entry.name} must answer { method, output?, \u2026 } without a planId: ${plan.problems.join("; ")}`, "Answer the method that commits the plan and \xA78's preview fields; the register mints the planId.")
      );
    }
    const method = plan.value["method"];
    if (entry.commit !== void 0 && method !== entry.commit) {
      throw new RegisterError(refusal("PLAN_INVALID", `${entry.name} answers ${method} as the method that commits it, but ${entry.commit} does`, `Answer method: "${entry.commit}".`));
    }
    return plan.value;
  }
  const checked = validate(entry.output, value);
  if (!checked.ok) throw new RegisterError(refusal("SCHEMA_VIOLATION", `${entry.name} answered something its schema does not describe: ${checked.problems.join("; ")}`, "Report it to the plugin's maintainers."));
  return checked.value;
}
var PLAN_FIELDS = ["output", "reaches", "changes", "cost", "trust"];
function publicPlan(planId, answer) {
  const value = { planId, method: answer["method"] };
  for (const field of PLAN_FIELDS) if (Object.hasOwn(answer, field)) value[field] = answer[field];
  return value;
}
function failureOf(entry, error) {
  const own = refusalOf(error);
  if (own) return own;
  return refusal("UNAVAILABLE", `${entry.name} failed: ${reasonOf(error)}`, "Try again; if it keeps failing, check the plugin's status.");
}
async function execute(environment, entry, prepared, call, bus) {
  if (prepared.reservation !== void 0) {
    const taken = environment.plans.consume(prepared.reservation);
    if (!taken.ok) throw new RegisterError(refusal(taken.code, taken.problems.join("; "), "Plan again, then commit with the new planId it answers."));
  }
  try {
    const value = checkedOutput(
      entry,
      await entry.handler.run(prepared.input, {
        ...call,
        account: prepared.account,
        ...prepared.plan === void 0 ? {} : { plan: prepared.plan },
        bus: bus(),
        unguardedAgents: async () => {
          try {
            return { ok: true, agents: unguardedAgents(await environment.agents(), environment.access.rules) };
          } catch (error) {
            return { ok: false, error: reasonOf(error) };
          }
        }
      })
    );
    if (entry.item.plans === true) {
      const answer = value;
      const recorded = environment.plans.record(answer, prepared.account, entry.commit ?? entry.name);
      if (!recorded.ok) {
        throw new RegisterError(refusal(recorded.code, recorded.problems.join("; "), "Answer a plan a copy can carry, at most 64 KB of JSON; preview everything the commit writes."));
      }
      return publicPlan(recorded.planId, answer);
    }
    return value;
  } catch (error) {
    if (error instanceof RegisterError) throw error;
    throw new RegisterError(failureOf(entry, error));
  }
}
function toolCall(context, door) {
  return { sessionID: context.sessionID, agent: context.agent, messageID: context.messageID, id: context.id, signal: context.signal, progress: context.progress, door };
}

// src/register/rpc.ts
var FAILED = {
  type: "object",
  properties: { code: { type: "string" }, next: { type: "string" } },
  required: ["code", "next"],
  additionalProperties: false
};
var plain4 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function strictEnvelope(input) {
  const schema = {
    type: "object",
    properties: {
      sessionID: { type: "string", minLength: 1 },
      input,
      grant: { type: "string", minLength: 1 },
      consumer: { type: "string", minLength: 1 }
    },
    required: ["sessionID", "input"],
    additionalProperties: false
  };
  Object.defineProperty(schema, "~standard", {
    enumerable: false,
    value: {
      version: 1,
      vendor: "plugin-contract",
      validate(value) {
        const checked = validate(schema, value);
        return checked.ok ? { value: checked.value } : { issues: checked.problems.map((message) => ({ message })) };
      }
    }
  });
  return schema;
}
function grantAct(environment, entry) {
  return environment.manifest.actions.find((action) => action.commit === entry.name)?.id ?? methodAction(environment.name, entry.name);
}
function grantActions(environment) {
  const actions = {};
  for (const entry of environment.entries) if (entry.item.class !== "read") actions[grantAct(environment, entry)] = "required";
  return actions;
}
async function rulesOf(context, sessionID) {
  let info;
  try {
    info = await context.session.get({ sessionID });
  } catch {
    throw new RegisterError(refusal("UNAVAILABLE", `there is no session '${sessionID}' in this location`, "Pass a session that exists, or create one first."));
  }
  if (info.agent === void 0 || info.agent === "") {
    throw new RegisterError(refusal("PERMISSION_DENIED", `session '${sessionID}' names no agent`, "Use a session with an agent, so its rules can decide the call."));
  }
  let agent;
  try {
    agent = await context.agent.get({ agentID: info.agent });
  } catch {
    throw new RegisterError(refusal("PERMISSION_DENIED", `session '${sessionID}' names the agent '${info.agent}', which does not exist in this location`, "Use a session whose agent exists."));
  }
  return { agent: info.agent, rules: [...agent.data.permissions, ...info.permissions ?? []] };
}
async function verify(environment, wiring, request, entry, account) {
  const token = request["grant"];
  if (typeof token !== "string" || token === "") return { ok: false, refusal: refusal("GRANT_INVALID", "the grant is not a token", "Pass the grant the host signed, or use a permission ask."), code: "GRANT_MALFORMED" };
  const consumer = request["consumer"];
  if (typeof consumer !== "string" || consumer === "") return { ok: false, refusal: refusal("GRANT_INVALID", "the grant names no consumer", "Pass the consumer the grant was issued to."), code: "GRANT_CLAIMS_INVALID" };
  const checked = await verifyGrant({
    grant: token,
    input: request["input"],
    act: grantAct(environment, entry),
    actions: grantActions(environment),
    keys: wiring.keys,
    audience: wiring.audience,
    consumer,
    capability: methodAction(environment.name, entry.name),
    account,
    ...wiring.scope === void 0 ? {} : { scope: wiring.scope },
    manifest: environment.hash,
    now: wiring.now?.() ?? Math.floor(Date.now() / 1e3),
    store: wiring.store
  });
  return checked.ok ? { ok: true, account: checked.claims.account } : { ok: false, refusal: refusal("GRANT_INVALID", checked.reason, "Ask the host to issue a fresh grant for this action and input."), code: checked.code };
}
async function invoke(context, environment, level, entry, wiring, raw, rpc, freshAsks, bus) {
  let prepared;
  try {
    if (!plain4(raw)) throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope must be an object", `Pass {"sessionID":"<session>","input":<the method's input>}.`));
    const sessionID = raw["sessionID"];
    if (typeof sessionID !== "string" || sessionID === "") throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope needs a sessionID", "Pass the session the call runs as."));
    const input = raw["input"];
    if (!plain4(input)) throw new RegisterError(refusal("INPUT_INVALID", "the RPC envelope needs an input object", "Pass the method's input as the envelope's input."));
    const resolved = await rulesOf(context, sessionID);
    const nonRead = entry.item.class !== "read";
    if (entry.item.effect === "deny") {
      throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is off under the plugin's access setting`, "Change the method's effect or the plugin's access setting."));
    }
    const callID = `rpc:${randomUUID2()}`;
    let gated = false;
    let fresh = false;
    if (nonRead) {
      if (level === "read-only") {
        throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is a ${entry.item.class} and the plugin's access is read-only`, "Set access to ask-changes, or use the agent tool in a session that allows it."));
      }
      if (raw["grant"] !== void 0) {
        if (wiring === void 0) throw new RegisterError(refusal("GRANT_INVALID", "this plugin has no grant verifier, so it cannot accept a grant", "Use a permission ask in a session, or configure the plugin's grant verifier."));
        prepared = prepareCall(entry, input, environment.accounts, environment.plans);
        const checked = await verify(environment, wiring, raw, entry, prepared.account);
        if (!checked.ok) {
          const failure = entry.item.commits !== void 0 && checked.code === "GRANT_ACCOUNT_MISMATCH" ? refusal("ACCOUNT_MISMATCH", "the grant names another account than the plan", "Issue the grant for the account the plan was made for.") : checked.refusal;
          throw new RegisterError(failure);
        }
        if (callEffect(environment.name, entry, prepared.account, resolved.rules) === "deny") {
          throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is denied for this session's agent`, "Use a session whose agent allows it."));
        }
        gated = true;
      } else {
        prepared = prepareCall(entry, input, environment.accounts, environment.plans);
        const effect = callEffect(environment.name, entry, prepared.account, resolved.rules);
        if (effect === "allow") {
          await gate(context, environment.name, entry, { sessionID, agent: resolved.agent, messageID: "msg_rpc", id: callID, signal: rpc.signal }, prepared.account, { save: false });
          gated = true;
          throw new RegisterError(refusal("PERMISSION_DENIED", `${environment.name}.${entry.name} is a ${entry.item.class} and an allow rule is not a confirmation for RPC`, "A non-read method over RPC needs a permission ask or a host-signed action grant."));
        }
        fresh = effect === "ask";
      }
    } else {
      prepared = prepareCall(entry, input, environment.accounts, environment.plans);
    }
    if (prepared === void 0) throw new RegisterError(refusal("UNAVAILABLE", "the RPC call prepared no input", "Try again; if it keeps failing, check the plugin's status."));
    if (!gated) {
      const source = { type: "tool", messageID: "msg_rpc", id: callID };
      if (fresh) freshAsks.add(callID);
      try {
        await gate(context, environment.name, entry, { sessionID, agent: resolved.agent, messageID: "msg_rpc", id: callID, signal: rpc.signal }, prepared.account, { save: false, source });
      } catch (error) {
        throw new RegisterError(permissionRefusal(error, `${environment.name}.${entry.name}`));
      } finally {
        if (fresh) freshAsks.delete(callID);
      }
    }
    const messageID = "msg_rpc";
    const id = `rpc:${randomUUID2()}`;
    const value = await execute(environment, entry, prepared, { sessionID, agent: resolved.agent, messageID, id, signal: rpc.signal, progress: async () => {
    }, door: "rpc" }, bus);
    return value === void 0 ? null : JSON.parse(JSON.stringify(value));
  } catch (error) {
    if (prepared?.reservation !== void 0) environment.plans.release(prepared.reservation);
    const own = refusalOf(error);
    const failure = own ?? refusal("UNAVAILABLE", "the RPC call failed", "Try again; if it keeps failing, check the plugin's status.");
    return rpc.error("failed", failure.message, { code: failure.code, next: failure.next });
  }
}
async function installRpc(context, environment, level, wiring, bus) {
  const methods = {};
  const handlers = {};
  for (const entry of environment.entries) {
    methods[entry.name] = { input: strictEnvelope(entry.input), output: entry.output, errors: { failed: FAILED } };
    handlers[entry.name] = (raw, call) => invoke(context, environment, level, entry, wiring, raw, call, freshAsks, bus);
  }
  const events = Object.fromEntries(Object.entries(busEvents(environment.name)).filter(([event]) => Object.hasOwn(environment.manifest.events, event)));
  const definition = { id: environment.name, methods, events };
  const freshAsks = /* @__PURE__ */ new Set();
  const hook = await context.permission.hook("evaluate", (event) => {
    if (event.source !== void 0 && freshAsks.has(event.source.id) && event.effect !== "deny") event.effect = "ask";
  });
  let registration;
  try {
    registration = await context.rpc.register(definition, handlers);
  } catch (error) {
    await hook.dispose().catch(() => void 0);
    throw error;
  }
  return {
    events: registration.events,
    async dispose() {
      await hook.dispose().catch(() => void 0);
      await registration.dispose();
    }
  };
}

// src/register/tools.ts
function textOf(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function codemodeFor(entry) {
  return entry.item.pinned === true ? { pinned: true } : true;
}
function toolRegistrations(environment, context, bus) {
  return environment.entries.map((entry) => ({
    name: entry.name,
    description: entry.handler.description,
    input: entry.input,
    output: entry.output,
    options: { namespace: environment.name, permission: `${environment.name}.${entry.name}`, codemode: codemodeFor(entry) },
    async execute(raw, callContext) {
      let prepared;
      try {
        prepared = prepareCall(entry, raw, environment.accounts, environment.plans);
        await gate(context, environment.name, entry, callContext, prepared.account, {
          save: true,
          source: { type: "tool", messageID: callContext.messageID, id: callContext.id }
        });
        const value = await execute(environment, entry, prepared, toolCall(callContext, callContext.codemode === true ? "codemode" : "tool"), bus);
        return { output: value, content: textOf(value) };
      } catch (error) {
        if (prepared?.reservation !== void 0) environment.plans.release(prepared.reservation);
        throw new Error(error instanceof RegisterError ? error.message : permissionRefusal(error, `${environment.name}.${entry.name}`).message);
      }
    }
  }));
}
async function installTools(context, environment, bus) {
  const tools = toolRegistrations(environment, context, bus);
  return await context.tool.transform((raw) => {
    const editor = raw;
    editor.namespace({ name: environment.name, description: environment.manifest.plugin.summary });
    for (const tool of tools) editor.add(tool);
  });
}

// src/bus/writer.ts
function createBus(name, registration) {
  assertPluginName(name);
  return {
    name,
    async emit(event, data) {
      if (!BUS_EVENTS.includes(event)) {
        return { ok: false, reason: "invalid", problems: ["event: must be one of changed, status, account"] };
      }
      const text = serialise(data);
      if (text !== void 0 && holdsSecret(text)) return { ok: false, reason: "secret" };
      const checked = checkBusData(name, event, data);
      if (!checked.ok) return { ok: false, reason: "invalid", problems: checked.problems };
      if (text === void 0) return { ok: false, reason: "invalid", problems: ["data: must be JSON"] };
      try {
        await registration.events.emit(event, checked.value);
      } catch {
        return { ok: false, reason: "unavailable" };
      }
      return { ok: true };
    }
  };
}

// src/register/register.ts
function accountsFor(manifest, options) {
  const plan = accountsOf(manifest, options);
  if (!plan.ok) {
    throw new Error(`OPTIONS_INVALID: ${plan.problems.join("; ")}. Next step: fix the plugin's accounts option.`);
  }
  return plan.value.accounts;
}
async function withCleanup(cleanup, action) {
  try {
    return await action();
  } catch (error) {
    for (const stop of [...cleanup].reverse()) await stop().catch(() => void 0);
    throw error;
  }
}
async function register(context, manifest, handlers, wiring = {}) {
  const name = manifest.plugin.name;
  assertPluginName(name);
  const options = context.options ?? {};
  const accounts = accountsFor(manifest, options);
  const access = await applyAccess(context, { manifest, options });
  if (access.problems.length > 0) {
    await access.dispose();
    throw new Error(access.problems.join("\n"));
  }
  return withCleanup([() => access.dispose()], async () => {
    const environment = prepare(manifest, handlers, accounts, access, async () => (await context.agent.list()).data);
    let bus;
    const writer = () => bus;
    const rpc = await installRpc(context, environment, access.level, wiring.grant, writer);
    bus = createBus(name, rpc);
    return withCleanup([() => rpc.dispose()], async () => {
      const tools = await installTools(context, environment, writer);
      return {
        name,
        bus,
        async dispose() {
          await rpc.dispose().catch(() => void 0);
          await tools.dispose().catch(() => void 0);
          await access.dispose().catch(() => void 0);
        }
      };
    });
  });
}

// src/register/host.ts
function assertHost(context, manifest) {
  if (hostInRange(context.app.version) || context.options?.["allowUntestedHost"] === true) return;
  throw new Error(
    `HOST_UNTESTED: ${manifest.plugin.name} supports ${manifest.plugin.host.opencode}, and OpenCode ${context.app.version} is outside it. Next step: install OpenCode 2.4.1, or set allowUntestedHost.`
  );
}
export {
  COMMIT_INPUT,
  PLAN_MAX_BYTES,
  PLAN_OUTPUT,
  RegisterError,
  assertHost,
  methodEntries,
  refusal,
  refusalOf,
  register
};
