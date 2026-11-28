// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  failure,
  failureFromError,
  statusAliases
} from "./chunks/chunk-FDKHDNC2.js";
import "./chunks/chunk-L2IBWQV5.js";
import "./chunks/chunk-6WEY3U6L.js";
import {
  actSessionRules
} from "./chunks/chunk-AMT4OSAU.js";
import {
  findAction,
  findMethod
} from "./chunks/chunk-YOSR7DZV.js";
import "./chunks/chunk-UY2FWVSQ.js";
import {
  MAX_BYTES_DEFAULT
} from "./chunks/chunk-RUQH3YH7.js";
import "./chunks/chunk-7KJXMIQH.js";
import {
  problemsOf
} from "./chunks/chunk-P2QQJNQB.js";
import "./chunks/chunk-M7EFVHR5.js";
import "./chunks/chunk-CCSPDV3H.js";
import {
  fromJSONSchema
} from "./chunks/chunk-AYJEC7Y2.js";
import "./chunks/chunk-WLRWVIVP.js";

// src/act.ts
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var refused = (code, what, next) => ({ ok: false, failure: failure(code, what, next) });
var bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
var CONFIRM_LIMIT = 20;
function schemaProblems(schema, data) {
  let checked;
  try {
    checked = fromJSONSchema(schema).safeParse(data);
  } catch {
    return ["the act's schema is not a JSON Schema this package can check"];
  }
  return checked.success ? [] : problemsOf(checked.error).slice(0, 3);
}
function confirmProblems(answer) {
  const problems = [];
  const reaches = answer["reaches"];
  if (reaches !== void 0) {
    if (!Array.isArray(reaches) || reaches.length > CONFIRM_LIMIT) {
      problems.push(`reaches must be a list of at most ${CONFIRM_LIMIT}`);
    } else {
      for (const [index, party] of reaches.entries()) {
        if (!plain(party) || typeof party["id"] !== "string" || party["id"].length === 0 || party["id"].length > 320) {
          problems.push(`reaches[${index}].id must be 1 to 320 characters`);
        } else if (party["label"] !== void 0 && (typeof party["label"] !== "string" || party["label"].length > 200)) {
          problems.push(`reaches[${index}].label must be at most 200 characters`);
        }
      }
    }
  }
  const changes = answer["changes"];
  if (changes !== void 0) {
    if (!Array.isArray(changes) || changes.length > CONFIRM_LIMIT || changes.some((change) => typeof change !== "string" || change.length === 0 || change.length > 500)) {
      problems.push(`changes must be a list of at most ${CONFIRM_LIMIT} sentences, each 1 to 500 characters`);
    }
  }
  return problems;
}
function checkAnswer(act2, account, answer) {
  let size;
  try {
    size = bytes(answer);
  } catch {
    return failure("SCHEMA_VIOLATION", `${act2.id} answered a value that is not JSON`, "Report it to the plugin's maintainers.");
  }
  const limit = MAX_BYTES_DEFAULT;
  if (size > limit) return failure("TOO_LARGE", `${act2.id} answered ${size} bytes, over its ${limit}`, "Ask the plugin to answer a smaller preview.");
  if (!plain(answer)) return failure("SCHEMA_VIOLATION", `${act2.id} answered something that is not an object`, "Report it to the plugin's maintainers.");
  if (answer["trust"] !== "untrusted") return failure("SCHEMA_VIOLATION", `${act2.id}'s answer is not marked trust: "untrusted"`, "Report it to the plugin's maintainers.");
  if (answer["account"] !== void 0 && answer["account"] !== account) {
    return failure("ACCOUNT_MISMATCH", `${act2.id} answered for another account than the one granted`, "Sign the plugin in to the granted account, or ask the person to grant this one.");
  }
  if (!Object.hasOwn(answer, "output")) return failure("SCHEMA_VIOLATION", `${act2.id}'s answer has no output`, "Report it to the plugin's maintainers.");
  const output = schemaProblems(act2.output, answer["output"]);
  if (output.length > 0) return failure("SCHEMA_VIOLATION", `${act2.id}'s output breaks its schema: ${output.join("; ")}`, "Report it to the plugin's maintainers.");
  const confirm = confirmProblems(answer);
  if (confirm.length > 0) return failure("SCHEMA_VIOLATION", `${act2.id}'s answer cannot be shown: ${confirm.join("; ")}`, "Report it to the plugin's maintainers.");
  return void 0;
}
function planProblems(act2, answer) {
  const planId = answer["planId"];
  if (typeof planId !== "string" || planId.length === 0) {
    return failure("SCHEMA_VIOLATION", `${act2.id}'s preview answered no planId`, "Report it to the plugin's maintainers.");
  }
  const method = answer["method"];
  if (method !== act2.commit) {
    return failure(
      "SCHEMA_VIOLATION",
      `${act2.id}'s preview names ${typeof method === "string" ? `"${method}"` : "no method"} as the method that commits it, and ${act2.commit} does`,
      "Report it to the plugin's maintainers."
    );
  }
  return void 0;
}
function answerOf(value) {
  return {
    trust: "untrusted",
    output: value["output"],
    ...value["reaches"] === void 0 ? {} : { reaches: value["reaches"] },
    ...value["changes"] === void 0 ? {} : { changes: value["changes"] },
    ...value["cost"] === void 0 ? {} : { cost: value["cost"] },
    ...value["account"] === void 0 ? {} : { account: value["account"] }
  };
}
async function fencedCall(host, rules, call, title) {
  if (!rules.ok) return { ok: false, failure: failure("PERMISSION_DENIED", rules.problems.join("; "), "Fix the act's declaration or the grant.") };
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
function commitValues(act2, request) {
  if (request.input !== void 0) {
    return { failure: failure("SCHEMA_VIOLATION", `a commit of ${act2.id} takes only { planId }, and this request carries input`, "Pass the planId the preview answered; the grant names the input.") };
  }
  const { planId, grantToken } = request;
  if (typeof planId !== "string" || planId.length === 0 || typeof grantToken !== "string" || grantToken.length === 0) {
    return {
      failure: failure(
        "PERMISSION_DENIED",
        `committing ${act2.id} needs the planId its preview answered and a host-signed action grant`,
        "Preview the act, ask the person, then commit with the planId the preview answered and the host-signed action grant for this act."
      )
    };
  }
  return { planId, grantToken };
}
async function act(host, request) {
  const { installed, grant } = request;
  const declared = findAction(installed.manifest, request.action);
  if (!declared) return refused("UNAVAILABLE", `${installed.package} ${installed.version} declares no act ${request.action}`, "Check the act id against the installed plugin's manifest.");
  if (request.phase !== "preview" && request.phase !== "commit") {
    return refused("SCHEMA_VIOLATION", "an act is previewed or committed", "Pass phase preview or commit.");
  }
  if (grant.disabled) return refused("SOURCE_DISABLED", `${declared.id} is turned off for ${grant.consumer}`, "Turn the act on again to preview or commit it.");
  if (grant.consumer !== request.consumer) return refused("PERMISSION_DENIED", `the grant is ${grant.consumer}'s, not ${request.consumer}'s`, "Ask the person to grant this consumer the act.");
  if (grant.action !== declared.id) return refused("PERMISSION_DENIED", `the grant is for ${grant.action}, not ${declared.id}`, "Use the grant for this act.");
  if (grant.manifestHash !== installed.hash) {
    return refused("PERMISSION_DENIED", `${declared.id}'s manifest changed since the person consented`, "Ask the person to review the action and consent again.");
  }
  const preview = findMethod(installed.manifest, declared.preview);
  const commit = findMethod(installed.manifest, declared.commit);
  if (preview === void 0 || commit === void 0) {
    const missing = preview === void 0 ? declared.preview : declared.commit;
    return refused("UNAVAILABLE", `${installed.package} ${installed.version} declares no method ${missing} for ${declared.id}`, "Check the act's declaration against the installed plugin's manifest.");
  }
  if (request.phase === "preview" && preview.plans !== true) {
    return refused("PLAN_INVALID", `${declared.id}'s preview method ${declared.preview} is not declared plans: true`, `Declare ${declared.preview} with plans: true so it answers the planId that commits the act.`);
  }
  if (request.phase === "commit") {
    const values = commitValues(declared, request);
    if ("failure" in values) return { ok: false, failure: values.failure };
    const accounts2 = await statusAliases(host, installed);
    if (!accounts2.ok) return { ok: false, failure: accounts2.failure };
    const called2 = await fencedCall(
      host,
      actSessionRules(installed.manifest, declared, grant, "commit", accounts2.value),
      {
        package: installed.package,
        method: declared.commit,
        input: { planId: values.planId },
        grant: values.grantToken,
        consumer: request.consumer,
        ...request.signal ? { signal: request.signal } : {}
      },
      `${request.consumer} commits ${declared.id}`
    );
    if (!called2.ok) return { ok: false, failure: called2.failure };
    const problem2 = checkAnswer(declared, grant.account, called2.answer);
    if (problem2) return { ok: false, failure: problem2 };
    return { ok: true, phase: "commit", result: answerOf(called2.answer) };
  }
  if (request.input !== void 0 && !plain(request.input)) {
    return refused("SCHEMA_VIOLATION", "an act's input must be an object", "Pass the input the act's schema describes.");
  }
  const inputProblems = schemaProblems(declared.input, request.input ?? {});
  if (inputProblems.length > 0) return refused("SCHEMA_VIOLATION", inputProblems.join("; "), "Pass only the input the act's schema describes.");
  const accounts = await statusAliases(host, installed);
  if (!accounts.ok) return { ok: false, failure: accounts.failure };
  const called = await fencedCall(
    host,
    actSessionRules(installed.manifest, declared, grant, "preview", accounts.value),
    {
      package: installed.package,
      method: declared.preview,
      input: { ...request.input ?? {}, ...preview.accounts === "optional" ? { account: grant.account } : {} },
      ...request.signal ? { signal: request.signal } : {}
    },
    `${request.consumer} previews ${declared.id}`
  );
  if (!called.ok) return { ok: false, failure: called.failure };
  const problem = checkAnswer(declared, grant.account, called.answer);
  if (problem) return { ok: false, failure: problem };
  const answer = called.answer;
  const plan = planProblems(declared, answer);
  if (plan) return { ok: false, failure: plan };
  return { ok: true, phase: "preview", preview: { ...answerOf(answer), planId: answer["planId"], method: answer["method"] } };
}
export {
  act
};
