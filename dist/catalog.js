// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  acceptAnswer,
  checkReadRequest,
  failureFromError,
  read
} from "./chunks/chunk-FDKHDNC2.js";
import "./chunks/chunk-L2IBWQV5.js";
import "./chunks/chunk-6WEY3U6L.js";
import "./chunks/chunk-AMT4OSAU.js";
import {
  readInstalledManifest
} from "./chunks/chunk-YOSR7DZV.js";
import "./chunks/chunk-UY2FWVSQ.js";
import "./chunks/chunk-RUQH3YH7.js";
import {
  canonicalScope
} from "./chunks/chunk-7KJXMIQH.js";
import "./chunks/chunk-P2QQJNQB.js";
import "./chunks/chunk-M7EFVHR5.js";
import "./chunks/chunk-CCSPDV3H.js";
import "./chunks/chunk-AYJEC7Y2.js";
import "./chunks/chunk-WLRWVIVP.js";

// src/catalog/broker.ts
function brokerRequest(request) {
  const asked = request.scope ?? request.grant.scope;
  const scope = asked === void 0 ? void 0 : canonicalScope(asked);
  return {
    package: request.installed.package,
    version: request.installed.version,
    manifestHash: request.installed.hash,
    consumer: request.consumer,
    source: request.source,
    account: request.grant.account,
    ...scope === void 0 ? {} : { scope },
    ...request.cursor === void 0 ? {} : { cursor: request.cursor },
    ...request.since === void 0 ? {} : { since: request.since },
    ...request.limit === void 0 ? {} : { limit: request.limit },
    ...request.pick === void 0 ? {} : { pick: request.pick }
  };
}
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var REQUEST_KEYS = /* @__PURE__ */ new Set(["package", "version", "manifestHash", "consumer", "source", "account", "scope", "cursor", "since", "limit", "pick"]);
function isBrokerAnswer(answer) {
  if (!plain(answer)) return false;
  if (answer["offered"] === false) return true;
  if (answer["offered"] !== true) return false;
  if (answer["ok"] === true) return "value" in answer;
  return answer["ok"] === false && typeof answer["code"] === "string" && typeof answer["message"] === "string";
}
function isBrokerRequest(request) {
  if (!plain(request)) return false;
  for (const key of Object.keys(request)) if (!REQUEST_KEYS.has(key)) return false;
  for (const key of ["package", "version", "consumer", "source"]) {
    const value = request[key];
    if (typeof value !== "string" || value.length === 0) return false;
  }
  const manifestHash = request["manifestHash"];
  if (typeof manifestHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(manifestHash)) return false;
  if (request["account"] !== void 0 && typeof request["account"] !== "string") return false;
  if (request["cursor"] !== void 0 && typeof request["cursor"] !== "string") return false;
  if (request["since"] !== void 0 && typeof request["since"] !== "string") return false;
  if (request["limit"] !== void 0 && !(typeof request["limit"] === "number" && Number.isInteger(request["limit"]) && request["limit"] > 0)) return false;
  const scope = request["scope"];
  if (scope !== void 0 && !(plain(scope) && Object.values(scope).every((values) => Array.isArray(values) && values.every((value) => typeof value === "string")))) return false;
  const pick = request["pick"];
  if (pick !== void 0 && !(Array.isArray(pick) && pick.every((value) => typeof value === "string"))) return false;
  return true;
}
function sourceReader(options) {
  const { host, broker } = options;
  const embedded = async (request) => ({ ...await read(host, request), via: "embedded" });
  if (!broker) return { read: embedded };
  return {
    async read(request) {
      const checked = checkReadRequest(request);
      if ("ok" in checked) return { ...checked, via: "embedded" };
      let answer;
      try {
        answer = await broker(brokerRequest(request), request.signal);
      } catch {
        return embedded(request);
      }
      if (!isBrokerAnswer(answer) || !answer.offered) return embedded(request);
      if (!answer.ok) {
        const failure = failureFromError({
          code: answer.code,
          message: answer.message,
          data: { ...answer.next === void 0 ? {} : { next: answer.next }, ...answer.retryAfterSec === void 0 ? {} : { retryAfterSec: answer.retryAfterSec } }
        });
        return { ok: false, failure, via: "broker" };
      }
      const accepted = acceptAnswer(checked.source, request.grant.account, answer.value, {
        ...request.limit === void 0 ? {} : { limit: request.limit },
        ...request.pick === void 0 ? {} : { pick: request.pick }
      });
      return { ...accepted, via: "broker", ...answer.cached === void 0 ? {} : { cached: answer.cached } };
    }
  };
}

// src/catalog/list.ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
var PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
var GIT_SHORTHAND = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
var GIT_PROTOCOL = /^(?:git\+[a-z0-9.+-]+:|git:\/\/)/i;
var GIT_SCP = /^[^@]+@[^:.]+\.[^:]+:.+$/i;
var GIT_HOSTED = /^(?:github|gitlab|bitbucket|gist):/i;
var HOSTED_GIT_HOSTS = /* @__PURE__ */ new Set(["github.com", "gitlab.com", "bitbucket.org", "gist.github.com", "git.sr.ht"]);
var plain2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function defaultCacheDirectory() {
  const cache = process.env["XDG_CACHE_HOME"] || join(homedir(), ".cache");
  return join(cache, "opencode");
}
var ILLEGAL = process.platform === "win32" ? /* @__PURE__ */ new Set(["<", ">", ":", '"', "|", "?", "*"]) : void 0;
function sanitize(value) {
  if (ILLEGAL === void 0) return value;
  return Array.from(value, (character) => ILLEGAL.has(character) || character.charCodeAt(0) < 32 ? "_" : character).join("");
}
function gitSlug(target) {
  const decoded = (() => {
    try {
      return decodeURIComponent(target.split("#")[0]);
    } catch {
      return target.split("#")[0];
    }
  })();
  return decoded.replace(/\.git$/i, "").split(/[/:\\]/).at(-1)?.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repository";
}
function registryTarget(target) {
  const slash = target.startsWith("@") ? target.indexOf("/") : -1;
  if (target.startsWith("@") && slash <= 0) return void 0;
  const at = target.indexOf("@", slash + 1);
  const name = at <= 0 ? target : target.slice(0, at);
  if (!PACKAGE_NAME.test(name)) return void 0;
  if (at <= 0) return { name };
  const spec = target.slice(at + 1);
  return spec === "" || spec.includes("/") || spec.includes("\\") ? void 0 : { name, spec };
}
function hostedGitUrl(target) {
  if (!/^(?:https?|ssh):\/\//i.test(target)) return false;
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOSTED_GIT_HOSTS.has(host)) return false;
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) return host === "gist.github.com" && segments.length === 1;
  const path = segments.join("/");
  if (host === "github.com") {
    return segments[2] === void 0 || segments[2] === "tree";
  }
  if (host === "gitlab.com") return !path.includes("/-/") && !path.includes("/archive.tar.gz");
  if (host === "bitbucket.org") return segments[2] !== "get";
  if (host === "gist.github.com") return segments[2] !== "raw";
  return segments[2] !== "archive";
}
function gitTarget(target) {
  const hosted = GIT_HOSTED.test(target);
  const protocol = GIT_PROTOCOL.test(target) || GIT_SCP.test(target);
  const url = hostedGitUrl(target);
  const shorthand = GIT_SHORTHAND.test(target);
  if (!hosted && !protocol && !url && !shorthand) return void 0;
  return { slug: gitSlug(target) };
}
function parseTarget(target) {
  const registry = registryTarget(target);
  if (registry !== void 0) return { kind: "registry", ...registry };
  const git = gitTarget(target);
  return git === void 0 ? void 0 : { kind: "git", ...git };
}
function cacheKey(target, parsed) {
  if (parsed?.kind === "git") return `git-${parsed.slug}-${createHash("sha256").update(target).digest("hex").slice(0, 12)}`;
  if (parsed?.kind === "registry") return sanitize(`${parsed.name}@${parsed.spec ?? "latest"}`);
  return sanitize(target);
}
function generations(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.filter((entry) => /^\d+$/.test(entry) && !entries.includes(`${entry}.rejected`)).sort((left, right) => Number(left) - Number(right));
}
function currentGeneration(directory) {
  const newest = generations(directory).at(-1);
  return newest === void 0 ? void 0 : join(directory, newest);
}
function installedName(parsed, generation) {
  if (parsed.kind === "registry") return parsed.name;
  try {
    const manifest = JSON.parse(readFileSync(join(generation, "package.json"), "utf8"));
    if (plain2(manifest)) {
      const dependencies = manifest["dependencies"];
      if (plain2(dependencies)) {
        const name = Object.keys(dependencies).find((entry) => PACKAGE_NAME.test(entry));
        if (name !== void 0) return name;
      }
    }
  } catch {
  }
  return PACKAGE_NAME.test(parsed.slug) ? parsed.slug : "repository";
}
function packageAt(cacheDirectory, key, parsed) {
  const generation = currentGeneration(join(cacheDirectory, "npm", key));
  if (generation === void 0) return void 0;
  const directory = join(generation, "node_modules", installedName(parsed, generation));
  return existsSync(directory) ? directory : void 0;
}
function packageVersion(directory) {
  try {
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    return plain2(manifest) && typeof manifest["version"] === "string" ? manifest["version"] : void 0;
  } catch {
    return void 0;
  }
}
function registryKeys(cacheDirectory, name) {
  const base = join(cacheDirectory, "npm");
  const prefix = sanitize(`${name}@`);
  const slash = name.startsWith("@") ? name.indexOf("/") : -1;
  let entries;
  try {
    entries = slash > 0 ? readdirSync(join(base, name.slice(0, slash))).map((entry) => `${name.slice(0, slash)}/${entry}`) : readdirSync(base);
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.startsWith(prefix)).sort().reverse();
}
function registryInstall(cacheDirectory, parsed, version) {
  const target = { kind: "registry", name: parsed.name };
  const exact = packageAt(cacheDirectory, sanitize(`${parsed.name}@${parsed.spec ?? "latest"}`), target);
  if (version === void 0) return exact;
  const matches = (directory) => packageVersion(directory) === version;
  if (exact !== void 0 && matches(exact)) return exact;
  const found = exact === void 0 ? [] : [exact];
  const keys = /* @__PURE__ */ new Set([
    sanitize(`${parsed.name}@${parsed.spec ?? "latest"}`),
    sanitize(`${parsed.name}@latest`),
    sanitize(`${parsed.name}@${version}`)
  ]);
  for (const key of keys) {
    const directory = packageAt(cacheDirectory, key, target);
    if (directory === void 0 || directory === exact) continue;
    if (matches(directory)) return directory;
    found.push(directory);
  }
  for (const key of registryKeys(cacheDirectory, parsed.name)) {
    if (keys.has(key)) continue;
    const directory = packageAt(cacheDirectory, key, target);
    if (directory === void 0) continue;
    if (matches(directory)) return directory;
    found.push(directory);
  }
  return found[0];
}
function gitInstall(cacheDirectory, target, parsed) {
  const generation = currentGeneration(join(cacheDirectory, "npm", cacheKey(target, { kind: "git", slug: parsed.slug })));
  if (generation === void 0) return void 0;
  const directory = join(generation, "node_modules", installedName({ kind: "git", slug: parsed.slug }, generation));
  return existsSync(directory) ? directory : void 0;
}
function locate(cacheDirectory, target, version) {
  const parsed = parseTarget(target);
  if (parsed === void 0) return void 0;
  if (parsed.kind === "registry") {
    const directory2 = registryInstall(cacheDirectory, parsed, version);
    return directory2 === void 0 ? void 0 : { directory: directory2, registry: true };
  }
  const directory = gitInstall(cacheDirectory, target, parsed);
  return directory === void 0 ? void 0 : { directory, registry: false };
}
function directDirectory(target) {
  if (target.startsWith("file:")) {
    try {
      return fileURLToPath(target);
    } catch {
      return void 0;
    }
  }
  return isAbsolute(target) ? target : void 0;
}
function singleFileProblem(path) {
  try {
    return statSync(path).isDirectory() ? void 0 : `a single-file local plugin has no package.json manifest: ${path}`;
  } catch {
    return void 0;
  }
}
var message = (error) => error instanceof Error ? error.message : String(error);
async function listInstalledPlugins(host, options = {}) {
  let listed;
  try {
    listed = (await host.plugin.list()).data;
  } catch (error) {
    return { plugins: [], problems: [{ target: "", problems: [`the plugin list could not be read: ${message(error)}`] }] };
  }
  const cacheDirectory = options.cacheDirectory ?? defaultCacheDirectory();
  const plugins = [];
  const problems = [];
  const seen = /* @__PURE__ */ new Set();
  for (const plugin of listed) {
    const source = plugin.source;
    if (source.type === "builtin" || source.type === "sdk") continue;
    const target = source.type === "local" ? source.path : source.target;
    if (plugin.state?.status === "failed") {
      const ref = plugin.state.ref === void 0 ? "" : ` (${plugin.state.ref})`;
      problems.push({ target, problems: [`the host reports this plugin failed to load: ${plugin.state.error}${ref}`] });
      continue;
    }
    if (source.type === "local") {
      const problem = singleFileProblem(source.path);
      if (problem !== void 0) {
        problems.push({ target, problems: [problem] });
        continue;
      }
      const installed2 = readInstalledManifest(source.path);
      if (installed2.ok) {
        if (seen.has(installed2.value.directory)) continue;
        seen.add(installed2.value.directory);
        plugins.push({ target, ...installed2.value });
      } else problems.push({ target, problems: installed2.problems });
      continue;
    }
    const parsed = parseTarget(source.target);
    const direct = options.resolve?.(source.target) ?? directDirectory(source.target);
    const located = direct === void 0 ? locate(cacheDirectory, source.target, source.version) : { directory: direct, registry: parsed?.kind === "registry" };
    if (located === void 0) {
      const why = parsed === void 0 ? `${source.target} is not an npm or Git package target the catalog can locate` : `no installed package for ${source.target} under ${join(cacheDirectory, "npm")}`;
      problems.push({ target, problems: [why] });
      continue;
    }
    const version = located.registry ? source.version : void 0;
    const installed = readInstalledManifest(located.directory, version === void 0 ? {} : { version });
    if (installed.ok) {
      if (located.registry && parsed?.kind === "registry" && installed.value.package !== parsed.name) {
        problems.push({ target, problems: [`the installed package is ${installed.value.package}, not the ${parsed.name} the host names`] });
        continue;
      }
      if (seen.has(installed.value.directory)) continue;
      seen.add(installed.value.directory);
      plugins.push({ target, ...installed.value });
    } else problems.push({ target, problems: installed.problems });
  }
  return { plugins, problems };
}
export {
  brokerRequest,
  isBrokerAnswer,
  isBrokerRequest,
  listInstalledPlugins,
  sourceReader
};
