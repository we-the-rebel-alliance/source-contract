// @we-the-rebel-alliance/source-contract 0.1.0. Built by scripts/build.mjs; do not edit.
import {
  SOURCES_SCHEMA
} from "./chunks/chunk-JU2UAXKA.js";
import "./chunks/chunk-HLVAKAYG.js";

// src/internal/conformance/rules.ts
var READ_VERBS = ["read", "get", "list", "search", "lookup", "view", "describe", "history", "query", "count", "status"];
var WRITE_VERB_WORDS = `send create update delete write post remove add set schedule upload download archive unarchive move merge close reopen approve reject share invite react draft complete run exec execute edit patch put push commit comment reply message broadcast follow block mute pin unpin star assign label lock trash forward dispatch clear flush reset truncate overwrite apply join leave ban toggle kick unban export grant revoke transfer promote demote rename duplicate restore purge wipe drop attach detach notify escalate resolve decline cancel submit vote snooze dismiss acknowledge ack enable disable connect disconnect login logout signin signout mint issue verify hide unhide publish unpublish ingest index reindex sync import save like unlike generate mark bookmark copy print convert`;
var WRITE_VERBS = WRITE_VERB_WORDS.split(" ");
var JOINERS = ["and", "then", "or"];
var CORE_KINDS = ["message", "meeting", "session", "bookmark", "issue", "pr", "commit", "doc", "event", "task", "file"];
var EVENT_FIELDS = ["external_id", "kind", "occurred_at", "title", "text", "url", "thread", "actors", "labels", "hash"];
var DETAIL_FIELDS = ["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"];
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var words = (name) => String(name ?? "").toLowerCase().split(/[._-]+/).filter(Boolean);
var unique = (values) => [...new Set(values)];
function nameProblem(name) {
  if (typeof name !== "string" || name.length === 0) return "a read must be named";
  const parts = words(name);
  const joiner = parts.find((word) => JOINERS.includes(word));
  if (joiner !== void 0) return `"${name}" joins two actions with "${joiner}": name the one action it is`;
  const writes = parts.filter((word) => WRITE_VERBS.includes(word));
  if (writes.length > 0) return `"${name}" contains the write verb ${writes.join(", ")}`;
  return void 0;
}
function readVerbProblem(name) {
  const problem = nameProblem(name);
  if (problem !== void 0) return problem;
  if (!words(name).some((word) => READ_VERBS.includes(word))) return `"${String(name)}" has no read verb (${READ_VERBS.join(", ")})`;
  return void 0;
}
function operationProblem(operation) {
  if (typeof operation !== "string" || operation.length === 0) return "an operation must be named";
  const parts = words(operation);
  const writes = parts.filter((word) => WRITE_VERBS.includes(word));
  if (writes.length > 0) return `"${operation}" contains the write verb ${writes.join(", ")}`;
  if (operation.includes(".")) {
    const last = operation.split(".").pop() ?? "";
    const head = words(last)[0] ?? "";
    if (!READ_VERBS.some((read) => head.startsWith(read) || last.startsWith(read))) {
      return `"${operation}" operates "${last}", which does not start with a read verb (${READ_VERBS.join(", ")}): a read never sends, changes or watches`;
    }
    return void 0;
  }
  if (!parts.some((word) => READ_VERBS.some((read) => word === read || word.startsWith(read)))) {
    return `"${operation}" has no read verb (${READ_VERBS.join(", ")}): a read never sends, changes or watches`;
  }
  return void 0;
}
var PUBLIC_SUFFIXES = /* @__PURE__ */ new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "me.uk",
  "net.uk",
  "sch.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "co.nz",
  "net.nz",
  "org.nz",
  "govt.nz",
  "co.jp",
  "ne.jp",
  "or.jp",
  "go.jp",
  "co.kr",
  "or.kr",
  "co.in",
  "net.in",
  "org.in",
  "co.za",
  "com.br",
  "net.br",
  "org.br",
  "com.mx",
  "com.ar",
  "com.co",
  "com.pe",
  "com.ve",
  "com.uy",
  "com.tr",
  "com.cn",
  "com.tw",
  "com.hk",
  "com.sg",
  "com.my",
  "com.ph",
  "com.vn",
  "com.pk",
  "com.ng",
  "com.sa",
  "com.eg",
  "com.ua",
  "com.pl",
  "com.es",
  "com.gr",
  "com.pt",
  "com.ro",
  "co.id",
  "co.il",
  "co.ke",
  "co.th",
  "co.ae",
  "co.ma",
  "co.bw",
  "co.zw",
  "co.tz",
  "co.ug"
]);
var SHARED_HOSTS = /* @__PURE__ */ new Set([
  "cloudfront.net",
  "amazonaws.com",
  "storage.googleapis.com",
  "blob.core.windows.net",
  "web.core.windows.net",
  "herokuapp.com",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "workers.dev",
  "github.io",
  "githubusercontent.com",
  "gitlab.io",
  "bitbucket.io",
  "appspot.com",
  "firebaseapp.com",
  "web.app",
  "azurewebsites.net",
  "elasticbeanstalk.com",
  "onrender.com",
  "railway.app",
  "fly.dev",
  "deno.dev",
  "glitch.me",
  "repl.co",
  "surge.sh",
  "ngrok.io",
  "r2.dev",
  "blogspot.com",
  "wordpress.com",
  "wixsite.com",
  "translate.goog",
  "ipfs.io",
  "dweb.link",
  "bit.ly",
  "tinyurl.com"
]);
var TRACKER_HOSTS = /* @__PURE__ */ new Set([
  "doubleclick.net",
  "google-analytics.com",
  "googletagmanager.com",
  "googleadservices.com",
  "googlesyndication.com",
  "2mdn.net",
  "facebook.net",
  "scorecardresearch.com",
  "criteo.com",
  "taboola.com",
  "outbrain.com",
  "adnxs.com",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "quantserve.com",
  "moatads.com",
  "adsrvr.org",
  "casalemedia.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "clarity.ms",
  "branch.io",
  "appsflyer.com",
  "adjust.com",
  "kochava.com",
  "smartadserver.com",
  "teads.tv",
  "yieldmo.com",
  "bat.bing.com"
]);
var EFFECTIVE_SLD = /* @__PURE__ */ new Set([
  "com",
  "co",
  "gov",
  "org",
  "net",
  "ac",
  "edu",
  "ne",
  "or",
  "go",
  "nic",
  "mil",
  "sch",
  "ltd",
  "plc",
  "gen",
  "web",
  "biz",
  "info",
  "nom",
  "res",
  "idv",
  "gob",
  "gouv",
  "gv",
  "k12",
  "muni"
]);
function urlHostProblem(host) {
  if (typeof host !== "string" || !/^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    return "is not a host pattern (a domain such as slack.com, or *.slack.com)";
  }
  const bare = host.toLowerCase().replace(/^\*\./, "");
  const labels = bare.split(".");
  if (labels.length < 2) return "names no registrable domain (a host needs at least two labels)";
  if (labels.some((label) => label.startsWith("xn--"))) return "is a punycode host (a label starting xn--), which hides what it is";
  let suffix = null;
  for (const size of [3, 2]) {
    if (labels.length > size && PUBLIC_SUFFIXES.has(labels.slice(-size).join("."))) {
      suffix = labels.slice(-size).join(".");
      break;
    }
  }
  if (PUBLIC_SUFFIXES.has(bare)) return `is a public suffix (${bare}), which names no site`;
  if (labels.length === 2 && EFFECTIVE_SLD.has(labels[0] ?? "") && /^[a-z]{2}$/.test(labels[1] ?? "")) return `is an effective-TLD rule (${bare}), which names no site`;
  if (suffix !== null && bare === suffix) return `is a public suffix (${suffix}), which names no site`;
  for (const listed of SHARED_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a shared host (${listed}), which anyone can claim`;
  for (const listed of TRACKER_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a tracker (${listed}), which is no source's destination`;
  return null;
}
function declarationProblems(sources, options = {}) {
  const checked = SOURCES_SCHEMA.check(sources);
  const problems = checked.ok ? [] : [...checked.problems];
  if (!plain(sources)) return problems;
  const items = Array.isArray(sources["items"]) ? sources["items"] : [];
  const tools = options.tools;
  const toolOf = (id) => tools?.find((tool) => tool.id === id);
  const ids = items.filter(isSourceItem).map((item) => item.id);
  for (const id of unique(ids)) {
    if (ids.filter((entry) => entry === id).length > 1) problems.push(`items: two sources share the id "${id}": a source id is unique`);
  }
  for (const [index, item] of items.entries()) {
    if (!isSourceItem(item)) continue;
    const at = `items[${index}] (${item.id})`;
    const head = item.id.split(".")[0] ?? item.id;
    for (const named of itemTools(item)) {
      const verb2 = nameProblem(named.name);
      if (verb2 !== void 0) problems.push(`${at}.${named.where}: ${verb2}`);
      if (tools !== void 0) {
        const declared = toolOf(named.name);
        if (declared === void 0) problems.push(`${at}.${named.where} names "${named.name}", which the plugin does not declare`);
        else if (declared.readOnly !== true) problems.push(`${at}.${named.where} names "${named.name}", which is not declared readOnly: true`);
      }
    }
    const action = item.kind === "events" ? item.permission.events : item.permission.tool;
    if (!action.startsWith(`${head}.`) && !action.startsWith(`${head}_`)) {
      problems.push(`${at}.permission.${item.kind === "events" ? "events" : "tool"} "${action}" is not in the plugin's namespace "${head}"`);
    }
    const verb = nameProblem(action);
    if (verb !== void 0) problems.push(`${at}.permission.${item.kind === "events" ? "events" : "tool"}: ${verb}`);
    for (const operation of item.permission.operations) {
      const problem = operationProblem(operation);
      if (problem !== void 0) problems.push(`${at}.permission.operations: ${problem}`);
    }
    for (const operation of unique(item.permission.operations)) {
      if (item.permission.operations.filter((entry) => entry === operation).length > 1) {
        problems.push(`${at}.permission.operations lists "${operation}" twice: an operation is granted once`);
      }
    }
    const details = item.kind === "events" ? item.details ?? [] : [];
    for (const [i, detail] of details.entries()) {
      const where = `${at}.details[${i}]`;
      if (!detail.id.startsWith(`${head}.`)) problems.push(`${where}.id "${detail.id}" does not start with the plugin's namespace "${head}."`);
      for (const field of detail.from) {
        const name = field;
        if (name === "title" || name === "text") {
          problems.push(`${where}.from names "${name}", which is item text: a detail's input comes only from an event's identifiers`);
        } else if (!EVENT_FIELDS.includes(name)) {
          problems.push(`${where}.from names "${name}", which is not an event field (${EVENT_FIELDS.join(", ")})`);
        }
      }
      for (const field of unique(detail.from)) {
        if (detail.from.filter((entry) => entry === field).length > 1) problems.push(`${where}.from names "${field}" twice`);
      }
    }
    for (const id of unique(details.map((entry) => entry.id))) {
      if (details.filter((entry) => entry.id === id).length > 1) problems.push(`${at}.details has two entries with the id "${id}"`);
    }
    const scope = item.scope;
    if (scope !== void 0) {
      for (const key2 of unique(scope.keys)) {
        if (scope.keys.filter((entry) => entry === key2).length > 1) problems.push(`${at}.scope.keys names "${key2}" twice`);
      }
      if (scope.suggest !== void 0 && tools !== void 0) {
        const declared = toolOf(scope.suggest);
        if (declared === void 0) problems.push(`${at}.scope.suggest names "${scope.suggest}", which the plugin does not declare`);
        else if (declared.readOnly !== true) problems.push(`${at}.scope.suggest names "${scope.suggest}", which is not declared readOnly: true`);
      }
    }
    for (const host of item.urlHosts ?? []) {
      const problem = urlHostProblem(host);
      if (problem !== null) problems.push(`${at}.urlHosts has ${JSON.stringify(host)}, which ${problem}`);
    }
  }
  return problems;
}
function assertDeclaration(sources, options = {}) {
  const problems = declarationProblems(sources, options);
  if (problems.length > 0) {
    throw new Error(`SCHEMA_VIOLATION: the sources declaration breaks contract version 1. Next step: fix each problem listed.
- ${problems.join("\n- ")}`);
  }
}
function itemTools(item) {
  const found = [{ name: item.tool, where: "tool" }];
  const details = item.kind === "events" ? item.details ?? [] : [];
  for (const [i, detail] of details.entries()) found.push({ name: detail.tool, where: `details[${i}].tool` });
  if (item.scope?.suggest !== void 0) found.push({ name: item.scope.suggest, where: "scope.suggest" });
  return found;
}
function isSourceItem(value) {
  if (!plain(value)) return false;
  const kind = value["kind"];
  if (kind !== "events" && kind !== "snapshot") return false;
  if (typeof value["id"] !== "string" || typeof value["tool"] !== "string") return false;
  const permission = value["permission"];
  if (!plain(permission) || !Array.isArray(permission["operations"])) return false;
  if (!permission["operations"].every((operation) => typeof operation === "string")) return false;
  const action = kind === "events" ? permission["events"] : permission["tool"];
  if (typeof action !== "string") return false;
  const details = value["details"];
  if (details !== void 0 && !Array.isArray(details)) return false;
  if (Array.isArray(details) && !details.every(isDetail)) return false;
  const scope = value["scope"];
  if (scope !== void 0) {
    if (!plain(scope) || !Array.isArray(scope["keys"]) || !scope["keys"].every((key2) => typeof key2 === "string")) return false;
    if (typeof scope["describe"] !== "string") return false;
    if (scope["suggest"] !== void 0 && typeof scope["suggest"] !== "string") return false;
  }
  const hosts = value["urlHosts"];
  if (hosts !== void 0 && (!Array.isArray(hosts) || !hosts.every((host) => typeof host === "string"))) return false;
  return true;
}
function isDetail(value) {
  return plain(value) && typeof value["id"] === "string" && typeof value["tool"] === "string" && Array.isArray(value["from"]);
}

// src/internal/conformance/permission.ts
var key = (action, resource) => `${action}\0${resource}`;
function grantsFor(source) {
  const head = source.id.split(".")[0] ?? source.id;
  const action = source.kind === "events" ? source.permission.events : source.permission.tool;
  const grants = [{ action, resource: "*" }];
  for (const operation of source.permission.operations) {
    const grant = operation.includes(".") ? { action: `${head}.read`, resource: `{account}:${operation}` } : { action: `${head}_${operation}`, resource: "*" };
    if (!grants.some((held) => held.action === grant.action && held.resource === grant.resource)) grants.push(grant);
  }
  return grants;
}
function sameResource(declared, asserted) {
  if (declared === asserted || declared === "*") return true;
  if (declared.startsWith("{account}:")) {
    return wildcard(declared.slice("{account}:".length), asserted.replace(/^[^:]*:/, ""));
  }
  return wildcard(declared, asserted);
}
function assertionMatches(assertions, grant) {
  return assertions.some(
    (assertion) => assertion.action === grant.action && (assertion.resources.length > 0 ? assertion.resources : ["*"]).some((resource) => sameResource(grant.resource, resource))
  );
}
function recordingPermission(grants) {
  const held = new Set(grants.map((grant) => key(grant.action, grant.resource)));
  const assertions = [];
  const undeclared = [];
  const permission = {
    async assert(input) {
      const resources = input.resources ?? ["*"];
      assertions.push({ action: input.action, resources });
      const allowed = resources.every(
        (resource) => [...held].some((entry) => {
          const [action, heldResource] = entry.split("\0");
          return sameResource(heldResource ?? "", resource) && wildcard(action ?? "", input.action);
        })
      );
      if (!allowed) {
        undeclared.push(input.action);
        throw Object.assign(
          new Error(`PERMISSION_DENIED: ${input.action} needs a grant this declaration does not hold. Next step: declare the action and its resource in the sources declaration.`),
          { _tag: "Tool.Error" }
        );
      }
    }
  };
  return { permission, assertions, undeclared };
}
function unusedGrants(grants, assertions) {
  return grants.filter((grant) => !assertionMatches(assertions, grant));
}
var wildcard = (pattern, value) => {
  const expression = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*").replaceAll("?", ".");
  return new RegExp(`^${expression}$`).test(value);
};

// src/internal/conformance/page.ts
var plain2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var instant = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
var text = (value, max) => typeof value === "string" && value.length <= max;
var X_KIND = /^x-[a-z][a-z0-9-]*\/[a-z][a-z0-9-]{0,31}$/;
function pageChecks(answer, options) {
  const shape = [];
  const cursor = [];
  const gap = [];
  const refused = [];
  const cost = [];
  const where = "the page";
  const none = { shape: ["the page is not an object"], cursor: [], gap: [], refused: [], cost: [] };
  if (!plain2(answer)) return none;
  if (answer["source"] !== options.source.id) shape.push(`${where} names source ${JSON.stringify(answer["source"])}, not ${options.source.id}`);
  if (answer["plugin"] !== options.plugin) shape.push(`${where} names plugin ${JSON.stringify(answer["plugin"])}, not ${options.plugin}`);
  if (typeof answer["account"] !== "string" || answer["account"].length === 0) shape.push(`${where} has no account: every result names one, default included`);
  if (!instant(answer["asOf"])) shape.push(`${where} asOf must be an ISO date-time with an offset`);
  if (answer["trust"] !== "untrusted") shape.push(`${where} trust must be "untrusted": every field is external text`);
  const owner = answer["owner"];
  if (owner === null) {
  } else if (owner === void 0) {
    shape.push(`${where} owner must be null or { id, label? }`);
  } else if (!plain2(owner) || typeof owner["id"] !== "string" || owner["id"].length === 0) {
    shape.push(`${where} owner must be null or { id, label? }`);
  } else if (owner["label"] !== void 0 && typeof owner["label"] !== "string") {
    shape.push(`${where} owner.label must be a string when present`);
  }
  if (typeof answer["cursor"] !== "string") shape.push(`${where} cursor must be a string`);
  else if (answer["cursor"].length > 1024) shape.push(`${where} cursor is longer than 1024 characters`);
  if (typeof answer["more"] !== "boolean") shape.push(`${where} more must be true or false`);
  const events = answer["events"];
  if (!Array.isArray(events)) shape.push(`${where} events must be a list`);
  const refusedEntries = entries(answer["refused"], `${where} refused`, shape);
  const failed = entries(answer["failed"], `${where} failed`, shape);
  gapChecks(answer["gap"], where, gap);
  costChecks(answer["cost"], options.source, where, cost);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, event] of (Array.isArray(events) ? events : []).entries()) {
    validateEvent(event, `${where} events[${index}]`, shape, seen);
  }
  const refusedIds = new Set(refusedEntries.map((entry) => entry.external_id));
  for (const id of seen) {
    if (refusedIds.has(id)) refused.push(`${where} lists ${id} as an event and in refused[]: a refusal is final`);
  }
  if (failed.length > 0) {
    const held = typeof options.input["cursor"] === "string" ? options.input["cursor"] : "";
    if (answer["cursor"] !== held) {
      cursor.push(`${where} failed[] holds the cursor back, and this page answered ${JSON.stringify(answer["cursor"])} instead of ${JSON.stringify(held)}`);
    }
  }
  if (Array.isArray(events) && events.length === 0 && answer["more"] === false && answer["cursor"] === "") {
    cursor.push(`${where} is empty and carries no cursor: a later call must be able to resume`);
  }
  return { shape, cursor, gap, refused, cost };
}
function pageProblems(answer, options) {
  const checks = pageChecks(answer, options);
  return [...checks.shape, ...checks.cursor, ...checks.gap, ...checks.refused, ...checks.cost];
}
function entries(value, where, problems) {
  if (value === void 0) {
    problems.push(`${where} must be a list, empty when nothing was dropped`);
    return [];
  }
  if (!Array.isArray(value)) {
    problems.push(`${where} must be a list`);
    return [];
  }
  const found = [];
  for (const [index, entry] of value.entries()) {
    if (!plain2(entry) || typeof entry["external_id"] !== "string" || entry["external_id"].length === 0 || entry["external_id"].length > 512) {
      problems.push(`${where}[${index}] must be { external_id, reason }`);
      continue;
    }
    if (!text(entry["reason"], 200) || entry["reason"] === "") problems.push(`${where}[${index}] names no reason`);
    found.push({ external_id: entry["external_id"] });
  }
  return found;
}
function gapChecks(value, where, problems) {
  if (value === void 0) return;
  if (!plain2(value)) {
    problems.push(`${where} gap must be an object`);
    return;
  }
  const reason = value["reason"];
  if (reason !== "expired" && reason !== "window-truncated") problems.push(`${where} gap.reason must be expired or window-truncated`);
  if (!instant(value["since"])) problems.push(`${where} gap.since must be an ISO date-time with an offset`);
  if (value["until"] !== void 0 && !instant(value["until"])) problems.push(`${where} gap.until must be an ISO date-time with an offset`);
  if (instant(value["since"]) && instant(value["until"]) && Date.parse(value["since"]) > Date.parse(value["until"])) {
    problems.push(`${where} gap.since is after gap.until`);
  }
}
function costChecks(value, source, where, problems) {
  if (value === void 0) {
    if (source.cost.class === "billed") problems.push(`${where} cost is missing: a billed source reports what the provider charged`);
    return;
  }
  if (!plain2(value)) problems.push(`${where} cost must be an object`);
}
function validateEvent(event, where, problems, seen) {
  if (!plain2(event)) {
    problems.push(`${where} is not an object`);
    return;
  }
  const id = event["external_id"];
  if (typeof id !== "string" || id.length === 0 || id.length > 512) problems.push(`${where} external_id must be 1 to 512 characters`);
  else {
    if (seen.has(id)) problems.push(`${where} external_id ${id} appears twice`);
    seen.add(id);
  }
  const kind = event["kind"];
  if (typeof kind !== "string" || !(CORE_KINDS.includes(kind) || X_KIND.test(kind))) {
    problems.push(`${where} kind must be one of ${CORE_KINDS.join(", ")}, or x-<plugin>/<kind>`);
  }
  if (!instant(event["occurred_at"])) problems.push(`${where} occurred_at must be an ISO date-time with an offset`);
  if (event["title"] !== void 0 && !text(event["title"], 300)) problems.push(`${where} title must be at most 300 characters`);
  if (event["text"] !== void 0 && !text(event["text"], 4096)) problems.push(`${where} text must be at most 4096 characters`);
  if (event["thread"] !== void 0 && typeof event["thread"] !== "string") problems.push(`${where} thread must be a string when present`);
  if (event["url"] !== void 0 && (typeof event["url"] !== "string" || !/^https:\/\//.test(event["url"]))) problems.push(`${where} url must be https`);
  if (event["labels"] !== void 0) {
    if (!Array.isArray(event["labels"]) || event["labels"].length > 20) problems.push(`${where} labels must be a list of at most 20`);
    else if (!event["labels"].every((label) => text(label, 64))) problems.push(`${where} each label must be at most 64 characters`);
  }
  if (event["actors"] !== void 0) {
    if (!Array.isArray(event["actors"]) || event["actors"].length > 20) problems.push(`${where} actors must be a list of at most 20`);
    else {
      for (const [index, actor] of event["actors"].entries()) {
        if (!plain2(actor) || typeof actor["id"] !== "string" || actor["id"].length === 0) problems.push(`${where} actors[${index}] must be { id, label? }`);
        else if (actor["label"] !== void 0 && typeof actor["label"] !== "string") problems.push(`${where} actors[${index}].label must be a string when present`);
      }
    }
  }
  if (typeof event["hash"] !== "string" || !/^sha256:[0-9a-f]{64}$/.test(event["hash"])) problems.push(`${where} hash must be sha256:<hex>`);
}

// src/internal/conformance/probe.ts
var plain3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var CONTENT_KEYS = ["events", "data", "body", "content", "items", "text", "title"];
function probeProblems(answer, source) {
  const where = `probe(${source.id})`;
  if (!plain3(answer)) return [`${where} answered nothing: an object with account and owner`];
  const problems = [];
  if (typeof answer["account"] !== "string" || answer["account"].length === 0) problems.push(`${where} must answer the account`);
  const owner = answer["owner"];
  if (owner !== null && owner !== void 0) {
    if (!plain3(owner) || typeof owner["id"] !== "string" || owner["id"].length === 0) problems.push(`${where} owner must be null or { id, label? }`);
    else if (owner["label"] !== void 0 && typeof owner["label"] !== "string") problems.push(`${where} owner.label must be a string when present`);
  } else if (owner === void 0) {
    problems.push(`${where} must answer owner as null or { id, label? }`);
  }
  for (const key2 of CONTENT_KEYS) {
    if (answer[key2] !== void 0) problems.push(`${where} must read no content, and it answered "${key2}"`);
  }
  const scopes = answer["scopes"];
  if (scopes !== void 0 && (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === "string"))) {
    problems.push(`${where} scopes must be a list of strings when present`);
  }
  return problems;
}

// src/internal/conformance/details.ts
var SENTINEL = "CONFORMANCE-SENTINEL-ITEM-TEXT";
function syntheticEvent(source) {
  const host = source.urlHosts?.[0]?.replace(/^\*\./, "") ?? "example.com";
  const kind = source.kind === "events" ? source.reads : "file";
  return {
    external_id: "conformance-1",
    kind: CORE_KINDS.includes(kind) ? kind : "x-conformance/item",
    occurred_at: "2026-01-01T09:00:00.000Z",
    title: SENTINEL,
    text: SENTINEL,
    url: `https://${host}/conformance/1`,
    thread: "conformance-thread:1",
    actors: [{ id: "conformance:1", label: "Conformance" }],
    labels: ["conformance"],
    hash: `sha256:${"0".repeat(64)}`
  };
}
function detailInput(detail, source, options) {
  const event = { ...syntheticEvent(source), ...options.event ?? {} };
  const fields = {};
  for (const field of detail.from) fields[field] = event[field];
  return { account: options.account, scope: options.scope ?? {}, fields };
}
function detailInputProblems(detail, input) {
  const problems = [];
  const where = `details(${detail.id})`;
  for (const field of Object.keys(input.fields)) {
    if (!detail.from.includes(field)) problems.push(`${where} was called with "${field}", which its from does not name`);
  }
  if (JSON.stringify(input.fields).includes(SENTINEL)) problems.push(`${where} was called with an event's title or text: a detail's input comes only from identifiers`);
  if (input.account.length === 0) problems.push(`${where} was called with no account`);
  return problems;
}
function scopeProblems(scope, declared, where) {
  const problems = [];
  const keys = declared?.keys ?? [];
  for (const key2 of Object.keys(scope)) {
    if (!keys.includes(key2)) problems.push(`${where} names the scope key "${key2}", which the source does not declare`);
  }
  for (const [key2, values] of Object.entries(scope)) {
    if (!Array.isArray(values) || values.length === 0) problems.push(`${where}.${key2} must list at least one confirmed value`);
  }
  return problems;
}

// src/internal/conformance/suggest.ts
var plain4 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function suggestProblems(answer, where) {
  if (!plain4(answer)) return [`${where} answered nothing: an object with options`];
  const problems = [];
  const options = answer["options"];
  if (!Array.isArray(options)) return [`${where} options must be a list, empty when there is nothing to offer`];
  if (options.length > 64) problems.push(`${where} offered ${options.length} options, over 64`);
  const ids = /* @__PURE__ */ new Set();
  for (const [index, option] of options.entries()) {
    if (!plain4(option) || typeof option["id"] !== "string" || option["id"].length === 0 || option["id"].length > 200) {
      problems.push(`${where} options[${index}] must be { id, label? }`);
      continue;
    }
    if (option["label"] !== void 0 && (typeof option["label"] !== "string" || option["label"].length > 200)) {
      problems.push(`${where} options[${index}].label must be at most 200 characters`);
    }
    if (ids.has(option["id"])) problems.push(`${where} offers ${option["id"]} twice`);
    ids.add(option["id"]);
  }
  return problems;
}

// src/internal/conformance/kit.ts
var RECOVERY_SINCE = "2026-01-01T00:00:00.000Z";
async function sourceConformance(options) {
  const { plugin, source, tools, calls } = options;
  const cases = options.cases ?? [];
  const account = options.account ?? "conformance";
  const grants = options.grants ?? grantsFor(source);
  const recording = recordingPermission(grants);
  const context = { account, permission: recording.permission };
  const checks = [];
  const add = (name, problems2, ran = true) => {
    checks.push({ name, ran, problems: problems2 });
  };
  add("declaration", declarationProblems({ contractVersion: 1, items: [source] }, { tools }));
  const shape = [];
  const cursor = [];
  const gap = [];
  const refused = [];
  const cost = [];
  let sawFailed = false;
  let sawRefused = false;
  let sawGap = false;
  let sawExpiry = false;
  if (cases.length > 0 && calls.list === void 0) shape.push("events_list cases are declared and the kit has no list call");
  for (const item of cases) {
    const where = `events_list(${item.name})`;
    const expect = item.expect ?? "page";
    let answer;
    try {
      answer = await calls.list?.(item.input, context);
    } catch (error) {
      if (isRefusal(expect)) {
        if (!messageOf(error).includes(expect.refuses)) shape.push(`${where}: refused with "${messageOf(error)}", not the expected ${expect.refuses}`);
        continue;
      }
      if (expect === "expired") {
        sawExpiry = true;
        gap.push(...await expiredByError(where, error, { source, plugin, calls, context }));
        continue;
      }
      shape.push(`${where}: failed: ${messageOf(error)}`);
      continue;
    }
    if (isRefusal(expect)) {
      shape.push(`${where}: it must be refused with ${expect.refuses}, and it answered`);
      continue;
    }
    if (expect === "expired") {
      sawExpiry = true;
      gap.push(...await expiredByGap(where, answer, { source, plugin, calls, context }));
      continue;
    }
    const page = { source, plugin, input: item.input };
    const result = pageChecks(answer, page);
    shape.push(...result.shape);
    cursor.push(...result.cursor);
    gap.push(...result.gap);
    refused.push(...result.refused);
    cost.push(...result.cost);
    sawFailed ||= hasEntries(answer, "failed");
    sawRefused ||= hasEntries(answer, "refused");
    sawGap ||= plain5(answer) && answer["gap"] !== void 0;
    if (expect === "empty" && Array.isArray(answer["events"]) && answer["events"].length > 0) {
      shape.push(`${where}: it must list nothing`);
    }
  }
  add("page-result", shape, cases.length > 0);
  add("failed-holds-cursor", cursor, sawFailed);
  add("gap-and-cursor-expired", gap, sawGap || sawExpiry);
  add("refused-is-final", refused, sawRefused);
  add("billed-cost", cost, source.cost.class === "billed" && cases.length > 0);
  const probe = [];
  const assertedBeforeProbe = recording.assertions.length;
  try {
    const answer = await calls.probe({ source: source.id, account }, context);
    probe.push(...probeProblems(answer, source));
  } catch (error) {
    probe.push(`probe(${source.id}) failed: ${messageOf(error)}`);
  }
  const probeAssertions = recording.assertions.slice(assertedBeforeProbe);
  if (probeAssertions.length === 0) probe.push(`probe(${source.id}) asserted nothing: it reads the identity under its own grant`);
  probe.push(...outsideGrants(probeAssertions, grants, `probe(${source.id})`));
  add("probe", probe);
  const details = [];
  const declaredDetails = source.kind === "events" ? source.details ?? [] : [];
  const detailCases = options.detailCases ?? declaredDetails.map((detail) => ({ id: detail.id }));
  for (const detailCase of detailCases) {
    const detail = declaredDetails.find((entry) => entry.id === detailCase.id);
    if (detail === void 0) {
      details.push(`details(${detailCase.id}) is not declared by the source`);
      continue;
    }
    const read = calls.details?.[detail.id];
    if (read === void 0) {
      details.push(`details(${detail.id}) is declared and the kit has no call for it`);
      continue;
    }
    const scope = detailCase.scope ?? {};
    details.push(...scopeProblems(scope, source.scope, `details(${detail.id})`));
    const input = detailInput(detail, source, { account, scope, ...detailCase.event === void 0 ? {} : { event: detailCase.event } });
    details.push(...detailInputProblems(detail, input));
    const assertedBeforeDetail = recording.assertions.length;
    try {
      const answer = await read(input, context);
      const result = pageChecks(answer, { source, plugin, input: {} });
      details.push(...result.shape, ...result.cursor, ...result.gap, ...result.refused, ...result.cost);
    } catch (error) {
      details.push(`details(${detail.id}) failed: ${messageOf(error)}`);
    }
    details.push(...outsideGrants(recording.assertions.slice(assertedBeforeDetail), grants, `details(${detail.id})`));
  }
  for (const detail of declaredDetails.filter((entry) => !detailCases.some((detailCase) => detailCase.id === entry.id))) {
    details.push(`details(${detail.id}) is declared and no detail case ran it`);
  }
  add("details", details, declaredDetails.length > 0);
  const suggest = [];
  const suggestTool = source.scope?.suggest;
  if (suggestTool !== void 0) {
    const assertedBeforeSuggest = recording.assertions.length;
    if (calls.suggest === void 0) suggest.push(`scope.suggest names "${suggestTool}" and the kit has no call for it`);
    else {
      try {
        const answer = await calls.suggest({ source: source.id, account }, context);
        suggest.push(...suggestProblems(answer, `scope.suggest(${suggestTool})`));
      } catch (error) {
        suggest.push(`scope.suggest(${suggestTool}) failed: ${messageOf(error)}`);
      }
      const suggestAssertions = recording.assertions.slice(assertedBeforeSuggest);
      if (suggestAssertions.length === 0) suggest.push(`scope.suggest(${suggestTool}) asserted nothing: even at bind it reads under the grant`);
      suggest.push(...outsideGrants(suggestAssertions, grants, `scope.suggest(${suggestTool})`));
    }
  }
  add("suggest", suggest, suggestTool !== void 0);
  const unused = source.kind === "events" && cases.length > 0 ? unusedGrants(grants, recording.assertions).map(
    (grant) => `the declaration grants ${grant.action} on ${grant.resource}, which no read asserts: a source's grants are exactly what it asserts`
  ) : [];
  add("unused-grants", unused, source.kind === "events" && cases.length > 0);
  if (recording.undeclared.length > 0) {
    checks.push({
      name: "undeclared-grants",
      ran: true,
      problems: recording.undeclared.map((action) => `${action} was asserted and is not among the grants the declaration derives`)
    });
  }
  const problems = checks.flatMap((check) => check.problems);
  return { source: source.id, plugin, checks, problems, ok: problems.length === 0 };
}
function assertConformance(report) {
  if (report.ok) return;
  throw new Error(
    `CONFORMANCE_FAILED: the source ${report.source} of ${report.plugin} fails ${report.checks.filter((check) => check.problems.length > 0).length} checks. Next step: fix each problem listed.
- ${report.problems.join("\n- ")}`
  );
}
function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
var isRefusal = (expect) => typeof expect === "object" && expect !== null && "refuses" in expect;
var plain5 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var hasEntries = (answer, key2) => plain5(answer) && Array.isArray(answer[key2]) && answer[key2].length > 0;
async function expiredByGap(where, answer, options) {
  if (!plain5(answer) || !plain5(answer["gap"]) || answer["gap"]["reason"] !== "expired") {
    return [`${where}: an expired cursor must answer gap.reason "expired", or throw CURSOR_EXPIRED`];
  }
  const cursor = answer["cursor"];
  if (typeof cursor !== "string" || cursor.length === 0) return [`${where}: an expired cursor must answer a cursor a consumer can restart from`];
  let next;
  try {
    next = await options.calls.list?.({ cursor }, options.context);
  } catch (error) {
    return [`${where} after the restart: failed with ${messageOf(error)}`];
  }
  const checks = pageChecks(next, { source: options.source, plugin: options.plugin, input: { cursor } });
  const problems = [...checks.shape, ...checks.cursor];
  if (plain5(next) && plain5(next["gap"]) && next["gap"]["reason"] === "expired") {
    problems.push(`${where}: the cursor the expired page answered expired again, so the round trip does not restart`);
  }
  return problems.map((problem) => `${where} after the restart: ${problem}`);
}
async function expiredByError(where, error, options) {
  const message = messageOf(error);
  if (!/^CURSOR_EXPIRED: /.test(message)) return [`${where}: failed with "${message}", not CURSOR_EXPIRED or a gap`];
  const since = instant(error.since) ? error.since : RECOVERY_SINCE;
  let next;
  try {
    next = await options.calls.list?.({ since }, options.context);
  } catch (error2) {
    return [`${where} after the restart: failed with ${messageOf(error2)}`];
  }
  const checks = pageChecks(next, { source: options.source, plugin: options.plugin, input: { since } });
  return [...checks.shape, ...checks.cursor].map((problem) => `${where} after the restart: ${problem}`);
}
function outsideGrants(assertions, grants, where) {
  const problems = [];
  for (const assertion of assertions) {
    const resources = assertion.resources.length > 0 ? assertion.resources : ["*"];
    for (const resource of resources) {
      const held = grants.some((grant) => assertionMatches([{ action: assertion.action, resources: [resource] }], grant));
      if (!held) problems.push(`${where} asserts ${assertion.action} on ${resource}, which the source does not grant: a read asserts only its own grant`);
    }
  }
  return problems;
}
export {
  CORE_KINDS,
  DETAIL_FIELDS,
  EVENT_FIELDS,
  JOINERS,
  READ_VERBS,
  SENTINEL,
  WRITE_VERBS,
  assertConformance,
  assertDeclaration,
  assertionMatches,
  declarationProblems,
  detailInput,
  detailInputProblems,
  grantsFor,
  instant,
  nameProblem,
  operationProblem,
  pageChecks,
  pageProblems,
  probeProblems,
  readVerbProblem,
  recordingPermission,
  sameResource,
  scopeProblems,
  sourceConformance,
  suggestProblems,
  syntheticEvent,
  unusedGrants,
  urlHostProblem
};
