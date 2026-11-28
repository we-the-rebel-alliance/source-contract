// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  pick,
  pickProblemsForOutput
} from "./chunk-L2IBWQV5.js";
import {
  resolveSince
} from "./chunk-6WEY3U6L.js";
import {
  detailRules,
  grantCovers,
  methodAction,
  probeRules,
  sessionRules
} from "./chunk-AMT4OSAU.js";
import {
  findMethod,
  findSource,
  maxBytesOf
} from "./chunk-YOSR7DZV.js";
import {
  checkOutput,
  isOutputName
} from "./chunk-UY2FWVSQ.js";
import {
  ERROR_CODES,
  PAGE,
  errorCodeOf,
  probeResultProblems,
  resultProblems
} from "./chunk-RUQH3YH7.js";
import {
  canonicalScope
} from "./chunk-7KJXMIQH.js";
import {
  DEFAULT_ALIAS
} from "./chunk-CCSPDV3H.js";

// src/internal/failure.ts
var FAILURE_CODES = ERROR_CODES;
function failure(code, what, next, retryAfterSec) {
  return {
    code,
    message: `${code}: ${what.replace(/[.\s]+$/, "")}. Next step: ${next}`,
    next,
    ...retryAfterSec === void 0 ? {} : { retryAfterSec }
  };
}
function failureFromError(error) {
  const record = typeof error === "object" && error !== null ? error : {};
  const data = typeof record["data"] === "object" && record["data"] !== null ? record["data"] : {};
  const message = typeof record["message"] === "string" ? record["message"] : String(error);
  const raw = [record["code"], data["code"], /^([A-Z][A-Z_]+):/.exec(message)?.[1]].find((code2) => typeof code2 === "string");
  const canonical = raw === void 0 ? void 0 : errorCodeOf(raw);
  const refusedInput = canonical === "INPUT_INVALID" || canonical === "SOURCE_UNKNOWN";
  const code = canonical !== void 0 && FAILURE_CODES.includes(canonical) ? canonical : void 0;
  const first = message.split(/\r?\n/, 1)[0].slice(0, 300);
  const fallback = refusedInput ? "Check the installed plugin against its manifest; if they match, report it to the plugin's maintainers." : "Try again later; if it keeps failing, check the plugin's status.";
  const next = typeof data["next"] === "string" ? data["next"] : /Next step: (.*)$/.exec(first)?.[1] ?? fallback;
  const what = first.replace(/^[A-Z][A-Z_]+:\s*/, "").replace(/\s*Next step:.*$/, "");
  const retry = typeof record["retryAfterSec"] === "number" ? record["retryAfterSec"] : typeof data["retryAfterSec"] === "number" ? data["retryAfterSec"] : void 0;
  return failure(code ?? "UNAVAILABLE", what || "the read failed", next, retry);
}

// src/read.ts
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var refused = (code, what, next) => ({ ok: false, failure: failure(code, what, next) });
var bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
function checkReadRequest(request) {
  const { installed, grant } = request;
  const source = findSource(installed.manifest, request.source);
  if (!source) return refused("UNAVAILABLE", `${installed.package} ${installed.version} declares no source ${request.source}`, "Check the source id against the installed plugin's manifest.");
  if (grant.disabled) return refused("SOURCE_DISABLED", `${source.id} is turned off for ${grant.consumer}`, "Turn the source on again to read it.");
  if (grant.consumer !== request.consumer) return refused("PERMISSION_DENIED", `the grant is ${grant.consumer}'s, not ${request.consumer}'s`, "Ask the person to grant this consumer the source.");
  if (grant.manifestHash !== installed.hash) {
    return refused("PERMISSION_DENIED", `${source.id}'s manifest changed since the person consented`, "Ask the person to review the source and consent again.");
  }
  const asked = request.scope ?? grant.scope;
  if (!grantCovers(grant, { source: source.id, account: grant.account, ...asked === void 0 ? {} : { scope: asked } })) {
    return refused("PERMISSION_DENIED", `the read asks for more of ${source.id} than the person granted`, "Read within the granted scope, or ask the person to widen it.");
  }
  const scope = asked === void 0 ? void 0 : canonicalScope(asked);
  if (source.kind === "events") {
    if (request.pick !== void 0) return refused("SCHEMA_VIOLATION", "pick is for a snapshot source", "Pass cursor, since and limit to an events source.");
    if (request.thumbnails === true && source.thumbnails !== true) {
      return refused("SCHEMA_VIOLATION", `${source.id} does not declare thumbnails`, "Ask for thumbnails only from a source that declares them.");
    }
  } else {
    if (request.cursor !== void 0 || request.since !== void 0 || request.limit !== void 0 || request.thumbnails !== void 0) {
      return refused("SCHEMA_VIOLATION", "cursor, since, limit and thumbnails are for an events source", "Pass pick to a snapshot source.");
    }
    if (request.pick !== void 0) {
      const problems = isOutputName(source.output) ? pickProblemsForOutput(source.output, request.pick) : [];
      if (problems.length > 0) return refused("SCHEMA_VIOLATION", problems.join("; "), "Pick only paths of the source's output schema.");
    }
  }
  return { source, ...scope === void 0 ? {} : { scope } };
}
function prepare(request) {
  const checked = checkReadRequest(request);
  if ("ok" in checked) return checked;
  const { source, scope } = checked;
  const input = { ...source.input ?? {}, account: request.grant.account };
  if (scope !== void 0) input["scope"] = scope;
  if (source.kind === "events") {
    if (request.since !== void 0) {
      const since = resolveSince(request.since, request.context);
      if (!since.ok) return refused("SCHEMA_VIOLATION", since.problems.join("; "), "Pass since as a relative time such as -7d, or an ISO date-time.");
      input["since"] = since.value;
    }
    if (request.cursor !== void 0) input["cursor"] = request.cursor;
    if (request.limit !== void 0) input["limit"] = request.limit;
    if (request.thumbnails === true) input["thumbnails"] = true;
    return { source, input };
  }
  return { source, input };
}
function checkAnswer(source, account, answer) {
  const size = bytes(answer);
  if (size > maxBytesOf(source)) return failure("TOO_LARGE", `${source.id} answered ${size} bytes, over its ${maxBytesOf(source)}`, "Read a smaller window or fewer items.");
  if (!plain(answer)) return failure("SCHEMA_VIOLATION", `${source.id} answered something that is not an object`, "Report it to the plugin's maintainers.");
  if (answer["trust"] !== "untrusted") return failure("SCHEMA_VIOLATION", `${source.id}'s answer is not marked trust: "untrusted"`, "Report it to the plugin's maintainers.");
  if (answer["account"] !== void 0 && answer["account"] !== account) {
    return failure("ACCOUNT_MISMATCH", `${source.id} answered for another account than the one granted`, "Sign the plugin in to the granted account, or ask the person to grant this one.");
  }
  return void 0;
}
async function statusAliases(host, installed) {
  if (host.status === void 0) {
    return { ok: false, failure: failure("UNAVAILABLE", `${installed.package} does not expose its status`, "The host must read the plugin's status before it can fence an account.") };
  }
  let answer;
  try {
    answer = await host.status({ package: installed.package });
  } catch (error) {
    return { ok: false, failure: failureFromError(error) };
  }
  if (!plain(answer) || !Array.isArray(answer["accounts"])) {
    return { ok: false, failure: failure("UNAVAILABLE", `${installed.package}'s status does not list its accounts`, "The host must read the plugin's status before it can fence an account.") };
  }
  const aliases = [];
  for (const account of answer["accounts"]) {
    if (!plain(account) || typeof account["alias"] !== "string" || account["alias"] === "") {
      return { ok: false, failure: failure("UNAVAILABLE", `${installed.package}'s status has an account without an alias`, "The host must read the plugin's status before it can fence an account.") };
    }
    aliases.push(account["alias"]);
  }
  const unique = [...new Set(aliases)];
  if (unique.length === 0 && installed.manifest.accounts !== void 0) {
    return { ok: false, failure: failure("UNAVAILABLE", `${installed.package}'s status lists no accounts`, "The host must read a status with the plugin's declared accounts before it can fence one.") };
  }
  return { ok: true, value: unique.length === 0 ? [DEFAULT_ALIAS] : unique };
}
async function fencedCall(host, rules, call, title) {
  if (!rules.ok) return { ok: false, failure: failure("PERMISSION_DENIED", rules.problems.join("; "), "Fix the source's declaration or the grant.") };
  let session;
  try {
    session = await host.openSession({ rules: rules.value, title });
    return { ok: true, answer: await host.call({ ...call, sessionID: session.sessionID }) };
  } catch (error) {
    return { ok: false, failure: failureFromError(error) };
  } finally {
    await session?.close().catch(() => void 0);
  }
}
async function read(host, request) {
  const prepared = prepare(request);
  if ("ok" in prepared) return prepared;
  const { source, input } = prepared;
  const accounts = await statusAliases(host, request.installed);
  if (!accounts.ok) return { ok: false, failure: accounts.failure };
  const called = await fencedCall(
    host,
    sessionRules(source, request.grant, accounts.value),
    { package: request.installed.package, method: source.method, input, ...request.signal ? { signal: request.signal } : {} },
    `${request.consumer} reads ${source.id}`
  );
  if (!called.ok) return { ok: false, failure: called.failure };
  return acceptAnswer(source, request.grant.account, called.answer, {
    ...request.limit === void 0 ? {} : { limit: request.limit },
    ...request.pick === void 0 ? {} : { pick: request.pick },
    ...request.thumbnails === void 0 ? {} : { thumbnails: request.thumbnails }
  });
}
function acceptAnswer(source, account, answer, options = {}) {
  const problem = checkAnswer(source, account, answer);
  if (problem) return { ok: false, failure: problem };
  const value = answer;
  if (source.kind === "events") {
    const problems = resultProblems(value, options.limit ?? PAGE.max, maxBytesOf(source), {
      ...options.thumbnails === true ? { thumbnails: true } : {},
      ...source.urlHosts === void 0 ? {} : { urlHosts: source.urlHosts }
    });
    if (problems.length > 0) {
      return { ok: false, failure: failure("SCHEMA_VIOLATION", `${source.id}'s page breaks the events contract: ${problems.slice(0, 3).join("; ")}`, "Report it to the plugin's maintainers.") };
    }
    return { ok: true, kind: "events", page: value };
  }
  if (isOutputName(source.output)) {
    const checked = checkOutput(source.output, value["data"]);
    if (!checked.ok) return { ok: false, failure: failure("SCHEMA_VIOLATION", `${source.id}'s data breaks the ${source.output} schema: ${checked.problems.slice(0, 3).join("; ")}`, "Report it to the plugin's maintainers.") };
  }
  if (typeof value["asOf"] !== "string" || !Number.isFinite(Date.parse(value["asOf"]))) {
    return { ok: false, failure: failure("SCHEMA_VIOLATION", `${source.id}'s snapshot has no asOf time`, "Report it to the plugin's maintainers.") };
  }
  let picked = value["data"];
  if (options.pick !== void 0) {
    const kept = pick(picked, options.pick);
    picked = kept.ok ? kept.data : {};
  }
  return {
    ok: true,
    kind: "snapshot",
    snapshot: { data: picked, asOf: value["asOf"], ...value["cost"] === void 0 ? {} : { cost: value["cost"] }, trust: "untrusted" }
  };
}
function detailFields(source, detailId, event) {
  const detail = source.details?.find((entry) => entry.id === detailId);
  if (!detail) return { ok: false, problems: [`${source.id} declares no detail read ${detailId}`] };
  const fields = {};
  const problems = [];
  for (const field of detail.from) {
    if (event[field] === void 0 || event[field] === null) problems.push(`the event has no ${field} for ${detailId}`);
    else fields[field] = event[field];
  }
  return problems.length === 0 ? { ok: true, value: fields } : { ok: false, problems };
}
async function readDetail(host, request) {
  const { installed, grant } = request;
  const source = findSource(installed.manifest, request.source);
  if (!source) return { ok: false, failure: failure("UNAVAILABLE", `${installed.package} declares no source ${request.source}`, "Check the source id.") };
  if (grant.disabled) return { ok: false, failure: failure("SOURCE_DISABLED", `${source.id} is turned off for ${grant.consumer}`, "Turn the source on again to read it.") };
  if (grant.consumer !== request.consumer || grant.manifestHash !== installed.hash) {
    return { ok: false, failure: failure("PERMISSION_DENIED", `the grant does not cover ${request.consumer}'s read of ${source.id} as installed`, "Ask the person to consent again.") };
  }
  if (request.event["account"] !== void 0 && request.event["account"] !== grant.account) {
    return { ok: false, failure: failure("ACCOUNT_MISMATCH", "the event is another account's", "Read details only for events of the granted account.") };
  }
  const fields = detailFields(source, request.detail, request.event);
  if (!fields.ok) return { ok: false, failure: failure("SCHEMA_VIOLATION", fields.problems.join("; "), "Read details only for events the source listed.") };
  const detail = source.details.find((entry) => entry.id === request.detail);
  const accounts = await statusAliases(host, installed);
  if (!accounts.ok) return { ok: false, failure: accounts.failure };
  const scope = grant.scope === void 0 ? {} : canonicalScope(grant.scope);
  const called = await fencedCall(
    host,
    detailRules(source, request.detail, grant, accounts.value),
    { package: installed.package, method: detail.method, input: { account: grant.account, scope, fields: fields.value }, ...request.signal ? { signal: request.signal } : {} },
    `${request.consumer} reads ${request.detail}`
  );
  if (!called.ok) return called;
  const problem = checkAnswer(source, grant.account, called.answer);
  return problem ? { ok: false, failure: problem } : { ok: true, answer: called.answer };
}
async function probe(host, request) {
  const source = findSource(request.installed.manifest, request.source);
  if (!source) return { ok: false, failure: failure("UNAVAILABLE", `${request.installed.package} declares no source ${request.source}`, "Check the source id.") };
  const method = findMethod(request.installed.manifest, "probe");
  if (method === void 0) return { ok: false, failure: failure("PERMISSION_DENIED", `${request.installed.package} declares no probe method`, "Declare probe in the manifest's methods.") };
  const operations = method.operations ?? [];
  const name = typeof source.input?.["source"] === "string" ? { source: source.input["source"] } : {};
  const accounts = await statusAliases(host, request.installed);
  if (!accounts.ok) return { ok: false, failure: accounts.failure };
  const called = await fencedCall(
    host,
    probeRules(source, request.account, operations, methodAction(request.installed.manifest.plugin.name, "probe"), accounts.value),
    { package: request.installed.package, method: "probe", input: { ...name, account: request.account }, ...request.signal ? { signal: request.signal } : {} },
    `probe ${source.id}`
  );
  if (!called.ok) return called;
  const answer = called.answer;
  if (plain(answer) && answer["owner"] === null) {
    return { ok: false, failure: failure("NEEDS_SIGN_IN", `${source.id} is not signed in`, "Sign the plugin in to the account you mean. A probe refuses with NEEDS_SIGN_IN; it never answers owner: null.") };
  }
  if (plain(answer) && typeof answer["account"] === "string" && answer["account"] !== request.account) return { ok: false, failure: failure("ACCOUNT_MISMATCH", `${source.id} is signed in to another account`, "Sign the plugin in to the account you mean.") };
  const problems = probeResultProblems(answer, { ...typeof source.input?.["source"] === "string" ? { source: source.input["source"] } : {}, account: request.account });
  if (problems.length > 0) {
    return { ok: false, failure: failure("SCHEMA_VIOLATION", `${source.id}'s probe answer is not the contract's: ${problems[0]}`, "Report it to the plugin's maintainers.") };
  }
  return { ok: true, answer };
}

export {
  failure,
  failureFromError,
  checkReadRequest,
  statusAliases,
  read,
  acceptAnswer,
  detailFields,
  readDetail,
  probe
};
