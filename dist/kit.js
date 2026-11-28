// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import "./chunks/chunk-2EGRD2TX.js";
import {
  DOC_FILES,
  TurnLog,
  automationApi,
  connectMcpServer,
  createAutomation,
  createCodeMode,
  createHost,
  docsFindings,
  mcpAddress,
  renderGeneratedDocs,
  waitForActivation
} from "./chunks/chunk-FLCJ7Y6A.js";
import "./chunks/chunk-EGSVFMLE.js";
import "./chunks/chunk-UP4MI2EO.js";
import "./chunks/chunk-FDKHDNC2.js";
import "./chunks/chunk-L2IBWQV5.js";
import "./chunks/chunk-6WEY3U6L.js";
import "./chunks/chunk-AMT4OSAU.js";
import {
  checkManifest
} from "./chunks/chunk-YOSR7DZV.js";
import "./chunks/chunk-UY2FWVSQ.js";
import {
  TESTED_OPENCODE,
  eventHash
} from "./chunks/chunk-RUQH3YH7.js";
import "./chunks/chunk-7KJXMIQH.js";
import "./chunks/chunk-P2QQJNQB.js";
import {
  secretFindings,
  secretKinds
} from "./chunks/chunk-M7EFVHR5.js";
import "./chunks/chunk-CCSPDV3H.js";
import "./chunks/chunk-AYJEC7Y2.js";
import "./chunks/chunk-WLRWVIVP.js";

// src/kit/cli.ts
import { execFile } from "node:child_process";
import { resolve } from "node:path";

// src/kit/bundled.ts
import { existsSync, readFileSync as readFileSync2, statSync as statSync2 } from "node:fs";
import { join as join2 } from "node:path";

// src/kit/files.ts
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
var SKIP_DIRECTORIES = [".git", ".hg", ".svn", "node_modules", "dist", "coverage", "release", "vendor", ".opencode", ".cache"];
var BINARY = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".avif",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".tar",
  ".wasm",
  ".node",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
  ".ogg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".jar",
  ".class",
  ".pyc"
]);
var TEXT_NAMES = /* @__PURE__ */ new Set(["AGENTS.md", "LICENSE", "LICENCE", "CODEOWNERS", "Dockerfile", "Makefile", "Procfile", "VERSION"]);
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".txt",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".svg",
  ".xml",
  ".env",
  ".example",
  ".lock"
]);
function isTextFile(path) {
  const name = path.slice(path.lastIndexOf(sep) + 1);
  if (TEXT_NAMES.has(name)) return true;
  if (name.startsWith(".env")) return true;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false;
  const extension = name.slice(dot).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) && !BINARY.has(extension);
}
function walkFiles(root, options = {}) {
  const skip = new Set(options.skip ?? SKIP_DIRECTORIES);
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const found = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        if (statSync(path).size > maxBytes) continue;
      } catch {
        continue;
      }
      found.push(path);
    }
  };
  visit(root);
  return found.sort();
}
function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}
function readText(path, maxBytes = 8 * 1024 * 1024) {
  try {
    if (statSync(path).size > maxBytes) return void 0;
    return readFileSync(path, "utf8");
  } catch {
    return void 0;
  }
}
function writeTextIfChanged(path, text) {
  try {
    if (readFileSync(path, "utf8") === text) return false;
  } catch {
  }
  writeFileSync(path, text);
  return true;
}
function readJson(path) {
  const text = readText(path);
  if (text === void 0) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function writeJsonIfChanged(path, value) {
  return writeTextIfChanged(path, `${JSON.stringify(value, null, 2)}
`);
}

// src/kit/bundled.ts
var KIT_BUNDLE_MARKER = "plugin-kit:dev-only";
var KIT_IMPORTS = ["@we-the-rebel-alliance/plugin-contract/kit", "plugin-contract/kit"];
function runtimeFiles(directory) {
  const found = /* @__PURE__ */ new Set();
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync2(join2(directory, "package.json"), "utf8"));
  } catch {
  }
  const consider = (value) => {
    if (typeof value === "string") {
      const path = join2(directory, value);
      if (existsSync(path) && statSync2(path).isFile()) found.add(path);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value;
    for (const key of ["default", "node", "module", "require", "types", "browser"]) consider(record[key]);
  };
  const exportsValue = pkg["exports"];
  if (typeof exportsValue === "object" && exportsValue !== null) {
    const map = exportsValue;
    consider(map["./server"]);
    consider(map["."]);
    consider(map["./tui"]);
  } else consider(exportsValue);
  for (const key of ["module", "main"]) consider(pkg[key]);
  const dist = join2(directory, "dist");
  if (existsSync(dist) && statSync2(dist).isDirectory()) {
    for (const path of walkFiles(dist, { skip: [] })) if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")) found.add(path);
  }
  for (const name of ["index.js", "index.mjs", "index.cjs"]) {
    const path = join2(directory, name);
    if (existsSync(path) && statSync2(path).isFile()) found.add(path);
  }
  return [...found];
}
function bundledFindings(directory) {
  const findings = [];
  for (const path of runtimeFiles(directory)) {
    if (!isTextFile(path)) continue;
    const text = readFileSync2(path, "utf8");
    const specifier = KIT_IMPORTS.find((entry) => text.includes(entry));
    if (specifier === void 0 && !text.includes(KIT_BUNDLE_MARKER)) continue;
    findings.push({
      id: "KIT_BUNDLED",
      level: "error",
      path: relativePath(directory, path),
      message: `the runtime build includes plugin-kit (${specifier ?? KIT_BUNDLE_MARKER}); the kit is a devDependency and is never bundled into a plugin`,
      fix: "Remove the kit from the server entry and runtime imports; use it only from scripts, tests and CI."
    });
  }
  return findings;
}

// src/kit/docs.ts
import { join as join4 } from "node:path";

// src/kit/plugin.ts
import { basename, join as join3 } from "node:path";

// src/kit/types.ts
var KitError = class extends Error {
  code;
  /** What happened, without the code and next step. */
  what;
  /** What to do about it. */
  next;
  constructor(code2, what, next) {
    const said = what.replace(/[.\s]+$/, "");
    super(`${code2}: ${said}. Next step: ${next}`);
    this.name = "KitError";
    this.code = code2;
    this.what = said;
    this.next = next;
  }
};
function hasError(findings) {
  return findings.some((finding) => finding.level === "error");
}
function sortFindings(findings) {
  return [...findings].sort((a, b) => (a.path ?? "").localeCompare(b.path ?? "") || a.id.localeCompare(b.id) || a.message.localeCompare(b.message));
}

// src/kit/plugin.ts
function readPlugin(dir) {
  const packageFile = join3(dir, "package.json");
  const raw = readJson(packageFile);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new KitError("KIT_NOT_A_PLUGIN", `${dir} has no readable package.json`, "run plugin-kit from a plugin's root directory, or pass --dir <plugin>");
  }
  const pkg = raw;
  const checked = checkManifest(pkg.capabilities);
  const manifest = checked.ok ? checked.value : void 0;
  const packageName = typeof pkg.name === "string" ? pkg.name.split("/").at(-1) : void 0;
  return {
    dir,
    packageFile,
    package: pkg,
    ...manifest === void 0 ? {} : { manifest },
    problems: checked.ok ? [] : checked.problems,
    name: manifest?.plugin.name ?? packageName ?? basename(dir),
    repository: repositoryName(pkg.repository) ?? `${manifest?.plugin.name ?? packageName ?? basename(dir)}-plugin`
  };
}
function repositoryUrl(repository) {
  const url = typeof repository === "string" ? repository : repository?.url;
  return typeof url === "string" ? url.trim() : void 0;
}
function repositoryName(repository) {
  const url = repositoryUrl(repository);
  if (url === void 0) return void 0;
  const trimmed = url.replace(/\.git$/, "").replace(/\/+$/, "");
  const segment = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return segment === "" ? void 0 : segment;
}
function repositoryOwner(repository) {
  const url = repositoryUrl(repository);
  if (url === void 0) return void 0;
  const shorthand = /^github:([^/\s]+)\//i.exec(url);
  if (shorthand !== null) return shorthand[1];
  const scp = /^git@github\.com:([^/\s]+)\//i.exec(url);
  if (scp !== null) return scp[1];
  const hosted = /^(?:git\+)?(?:https?|git|ssh):\/\/(?:[^@/\s]+@)?(?:www\.)?github\.com\/([^/\s]+)\//i.exec(url);
  return hosted?.[1];
}
function requireManifest(plugin) {
  if (plugin.manifest !== void 0) return plugin.manifest;
  throw new KitError(
    "KIT_MANIFEST",
    `${plugin.name}'s capabilities manifest does not validate:
- ${plugin.problems.join("\n- ")}`,
    "fix capabilities in package.json; docs/contract.md \xA74 is the shape"
  );
}

// src/kit/output.ts
function printFinding(context, finding) {
  const where = finding.path === void 0 ? "" : ` ${finding.path}`;
  context.io.stderr(`${finding.level.toUpperCase()} ${finding.id}${where}: ${finding.message}${finding.fix === void 0 ? "" : ` ${finding.fix}`}
`);
}
function print(context, findings, summary) {
  if (context.json) {
    context.io.stdout(`${JSON.stringify({ findings: sortFindings(findings), ok: !hasError(findings) }, null, 2)}
`);
    return;
  }
  for (const finding of sortFindings(findings)) printFinding(context, finding);
  const errors = findings.filter((finding) => finding.level === "error").length;
  const warnings = findings.filter((finding) => finding.level === "warning").length;
  context.io.stdout(`${summary}${findings.length === 0 ? "" : ` (${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"})`}
`);
}

// src/kit/docs.ts
var generatedMarkers = (section) => ({
  start: `<!-- generated:${section} -->`,
  end: `<!-- /generated:${section} -->`
});
function applies(manifest, section) {
  if (section === "accounts") return manifest.accounts !== void 0;
  if (section === "automations") return manifest.sources.some((source) => source.kind === "events");
  return true;
}
function applySection(text, section, body) {
  const { start, end } = generatedMarkers(section);
  const startAt = text.indexOf(start);
  if (startAt === -1) return { text, missing: "start" };
  const endAt = text.indexOf(end, startAt + start.length);
  if (endAt === -1) return { text, missing: "end" };
  return { text: `${text.slice(0, startAt + start.length)}
${body.trim()}
${text.slice(endAt)}`, missing: void 0 };
}
function missingDocFiles(dir) {
  return DOC_FILES.filter((doc) => readText(join4(dir, doc.file)) === void 0).map((doc) => ({
    id: "DOCS.missing-file",
    level: "error",
    path: doc.file,
    message: `${doc.file} is missing, so its generated sections cannot be checked`,
    fix: `create ${doc.file} with the generated blocks docs/kit.md lists`
  }));
}
function docsFindings2(dir, manifest) {
  return sortFindings([...missingDocFiles(dir), ...docsFindings(dir, manifest)]);
}
function rendered(dir, manifest) {
  const sections = renderGeneratedDocs(manifest);
  const files = /* @__PURE__ */ new Map();
  const findings = [];
  for (const doc of DOC_FILES) {
    const text = readText(join4(dir, doc.file));
    if (text === void 0) {
      findings.push({ id: "DOCS.missing-file", level: "error", path: doc.file, message: `${doc.file} is missing, so its generated sections cannot be written`, fix: `create ${doc.file} with the generated blocks docs/kit.md lists` });
      continue;
    }
    let next = text;
    for (const section of doc.sections) {
      if (!applies(manifest, section)) continue;
      const applied = applySection(next, section, sections[section]);
      if (applied.missing !== void 0) {
        const { start, end } = generatedMarkers(section);
        findings.push({
          id: "DOCS.missing-marker",
          level: "error",
          path: doc.file,
          message: `${doc.file} has no "${start}" \u2026 "${end}" pair, so the ${section} section cannot be written`,
          fix: `add the pair to ${doc.file}, then run plugin-kit docs`
        });
        continue;
      }
      next = applied.text;
    }
    files.set(doc.file, next);
  }
  return { files, findings };
}
async function runDocs(context, options) {
  const plugin = readPlugin(context.dir);
  if (plugin.manifest === void 0) {
    const findings = [{ id: "DOCS.manifest", level: "error", message: "the capabilities manifest does not validate, so no generated section can be checked", fix: "fix capabilities in package.json; docs/contract.md \xA74 is the shape" }];
    print(context, findings, "docs: not current");
    return 1;
  }
  if (options.check) {
    const findings = docsFindings2(context.dir, plugin.manifest);
    print(context, findings, findings.length === 0 ? "docs: current" : "docs: not current");
    return hasError(findings) ? 1 : 0;
  }
  const result = rendered(context.dir, plugin.manifest);
  const changed = [];
  if (!hasError(result.findings)) {
    for (const [file, text] of result.files) if (writeTextIfChanged(join4(context.dir, file), text)) changed.push(file);
  }
  if (context.json) {
    context.io.stdout(`${JSON.stringify({ command: "docs", ok: !hasError(result.findings), changed, findings: result.findings }, null, 2)}
`);
  } else {
    for (const finding of sortFindings(result.findings)) printFinding(context, finding);
    context.io.stdout(result.findings.length === 0 ? `docs: ${changed.length === 0 ? "up to date" : `${changed.length} file${changed.length === 1 ? "" : "s"} updated`} (${DOC_FILES.length} files)
` : `docs: ${result.findings.length} problem${result.findings.length === 1 ? "" : "s"}
`);
  }
  return hasError(result.findings) ? 1 : 0;
}

// src/kit/forbidden.ts
import { basename as basename2, join as join5 } from "node:path";

// src/kit/forbidden-apps.ts
var FORBIDDEN_APPS = Object.freeze([
  { name: "Jelly", pattern: /\bjelly\b/gi },
  { name: "Jelly", pattern: /hey-jelly\b/gi },
  { name: "Jelly", pattern: /jelly-(?:ops|rpc|plugin|models|family)\b/gi },
  { name: "Toqan", pattern: /\btoqan\b/gi }
]);

// src/kit/grant-token.ts
import { createPublicKey, verify } from "node:crypto";
function isEd25519PublicKey(value) {
  if (typeof value !== "string") return false;
  try {
    return createPublicKey(value).asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}
function verifiesGrantToken(token, publicKey) {
  if (typeof token !== "string" || typeof publicKey !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return false;
  try {
    const key = createPublicKey(publicKey);
    const signature2 = Buffer.from(parts[2], "base64url");
    return verify(null, Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"), key, signature2);
  } catch {
    return false;
  }
}
function verifiedGrantTokens(value) {
  const grants = typeof value === "object" && value !== null ? value["grants"] : void 0;
  if (typeof grants !== "object" || grants === null) return /* @__PURE__ */ new Set();
  const record = grants;
  const publicKey = record["publicKey"];
  const cases = record["cases"];
  if (!isEd25519PublicKey(publicKey) || !Array.isArray(cases)) return /* @__PURE__ */ new Set();
  const verified = /* @__PURE__ */ new Set();
  for (const entry of cases) {
    if (typeof entry !== "object" || entry === null) continue;
    const token = entry["token"];
    if (typeof token === "string" && verifiesGrantToken(token, publicKey)) verified.add(token);
  }
  return verified;
}
function fixturePublicKey(value) {
  const grants = typeof value === "object" && value !== null ? value["grants"] : void 0;
  if (typeof grants !== "object" || grants === null) return void 0;
  const key = grants["publicKey"];
  return isEd25519PublicKey(key) ? key : void 0;
}

// src/kit/secret-scan.ts
var DECLARATION = /\b(?:const|let|var|val|final)\s+(?:[\w$<>[\].?]+\s+)?$/;
var FUNCTION_START = /^\s*(?:(?:export|default|public|private|protected|static|abstract|async|override|declare|pub)\s+)*(?:function\*?|def|fn|func|fun|constructor)\b/;
var AFTER_SIGNATURE = /^\s*(?::|=>|->|\{)/;
var EXPRESSION = /^(?:\+\+|--|!)?[A-Za-z_$][\w$.<>[\]|?]*$/;
var OPERAND = /^[^\s,;)]*/;
var FORMAT_PARTS = /^(?:header|payload|claims|body|signature|sig)(?:\.(?:header|payload|claims|body|signature|sig))+$/;
function enclosingParenthesis(line, offset) {
  const open = [];
  for (let index = 0; index < offset; index++) {
    const char = line[index];
    if (char === "(" || char === "[" || char === "{") open.push(index);
    else if (char === ")" || char === "]" || char === "}") open.pop();
  }
  const innermost = open.pop();
  return innermost !== void 0 && line[innermost] === "(" ? innermost : void 0;
}
function signature(line, open, valueOffset) {
  if (!/[\w$>]/.test(line[open - 1] ?? "")) return false;
  if (FUNCTION_START.test(line.slice(0, open))) return true;
  let depth = 0;
  for (let index = valueOffset; index < line.length; index++) {
    const char = line[index];
    if (char === "(") depth++;
    else if (char === ")") {
      if (depth === 0) return AFTER_SIGNATURE.test(line.slice(index + 1));
      depth--;
    }
  }
  return false;
}
function setAside(text, finding) {
  const site = finding.assignment;
  if (site === void 0) return false;
  if (site.quote === "`") return FORMAT_PARTS.test(site.value);
  if (site.quote !== void 0) return false;
  const lineStart = text.lastIndexOf("\n", finding.index - 1) + 1;
  const lineEnd = text.indexOf("\n", site.valueIndex);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const rest = line.slice(site.valueIndex - lineStart);
  const operand = OPERAND.exec(rest)[0];
  if (!EXPRESSION.test(operand) || /^\s+[\w$'"`]/.test(rest.slice(operand.length))) return false;
  const keyOffset = finding.index - lineStart;
  if (site.separator.includes("=")) return DECLARATION.test(line.slice(0, keyOffset));
  const open = enclosingParenthesis(line, keyOffset);
  return open !== void 0 && signature(line, open, site.valueIndex - lineStart);
}
function forbiddenSecretKinds(text) {
  return [...new Set(secretFindings(text).filter((finding) => !setAside(text, finding)).map((finding) => finding.kind))];
}

// src/kit/forbidden.ts
var SKIPPED_FILES = /* @__PURE__ */ new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "composer.lock", "Cargo.lock"]);
var MAIN_LINK = /\bhttps?:\/\/(?:www\.)?github\.com\/([^/\s)"'<>]+)\/[^\s)"'<>]*\/(?:blob|tree|raw)\/main(?:[/#?]|\b)/gi;
var RAW_MAIN_LINK = /\bhttps?:\/\/raw\.githubusercontent\.com\/([^/\s)"'<>]+)\/[^\s)"'<>]*\/main(?:[/#?]|\b)/gi;
var SHORT_MAIN_LINK = /\bgithub\.com\/([^/\s)"'<>]+)\/[^\s)"'<>]*\/(?:blob|tree|raw)\/main(?:[/#?]|\b)/gi;
var ALLOW_FILE = ".plugin-kit/forbidden-allow";
var PATTERNS = ["app-name", "main-branch", "secret", "grant-email"];
function allowances(dir) {
  const text = readText(join5(dir, ALLOW_FILE));
  if (text === void 0) return [];
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const match = /^(.*):(app-name|main-branch|secret|grant-email|FORBIDDEN\.(?:app-name|main-branch|secret|grant-email))\s+(.+)$/.exec(trimmed);
    if (match === null) continue;
    const reason = match[3].trim();
    if (reason === "") continue;
    found.push({ path: normalizePath(match[1]), pattern: match[2].replace(/^FORBIDDEN\./, ""), reason });
  }
  return found;
}
var normalizePath = (path) => path.replace(/\\/g, "/").replace(/^\.\//, "");
function add(findings, used, allowances2, finding) {
  const pattern = finding.id.replace(/^FORBIDDEN\./, "");
  const allow = allowances2.find((entry) => entry.pattern === pattern && entry.path === finding.path);
  if (allow !== void 0 && PATTERNS.includes(allow.pattern)) {
    used.set(allow, (used.get(allow) ?? 0) + 1);
    return;
  }
  findings.push(finding);
}
function grantTokens(text) {
  try {
    return [...verifiedGrantTokens(JSON.parse(text))];
  } catch {
    return [];
  }
}
var EMAIL = /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+)/g;
function exampleDomain(domain) {
  const lower = domain.toLowerCase();
  return lower === "example.test" || lower === "example.com" || lower.endsWith(".example.test") || lower.endsWith(".example.com");
}
function grantClaimText(token) {
  if (typeof token !== "string") return void 0;
  const parts = token.split(".");
  if (parts.length !== 3) return void 0;
  const payload = parts[1];
  if (payload === void 0 || payload === "") return void 0;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return void 0;
  }
}
function grantClaimFindings(relative2, text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  const grants = typeof value === "object" && value !== null ? value["grants"] : void 0;
  if (typeof grants !== "object" || grants === null) return [];
  const cases = grants["cases"];
  if (!Array.isArray(cases)) return [];
  const findings = [];
  for (const [index, entry] of cases.entries()) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry;
    const where = typeof record["name"] === "string" ? record["name"] : `case ${index + 1}`;
    const claims = grantClaimText(record["token"]);
    if (claims !== void 0) {
      for (const kind of secretKinds(claims)) {
        findings.push({
          id: "FORBIDDEN.secret",
          level: "error",
          path: relative2,
          message: `the signed grant claim in ${where} holds a credential (${kind}); a committed fixture never carries one`,
          fix: "remove it, rotate it with the provider, and record the fixture again through plugin-kit record"
        });
      }
    }
    const expect = typeof record["expect"] === "object" && record["expect"] !== null ? record["expect"] : {};
    if (expect["ok"] !== true) continue;
    const scanned = [claims ?? "", JSON.stringify(record["input"] ?? ""), JSON.stringify(record["request"] ?? "")];
    let outside = false;
    for (const candidate of scanned) {
      for (const match of candidate.matchAll(new RegExp(EMAIL.source, EMAIL.flags))) if (!exampleDomain(match[1])) outside = true;
    }
    if (outside) {
      findings.push({
        id: "FORBIDDEN.grant-email",
        level: "error",
        path: relative2,
        // The address is personal data: name the case, never the mailbox or its domain.
        message: `verified grant case ${where} carries an address outside example.test and example.com; a fixture uses invented addresses only`,
        fix: "replace the address with one on example.test or example.com, and record the fixture again"
      });
    }
  }
  return findings;
}
function packageOwner(dir) {
  const raw = readJson(join5(dir, "package.json"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  return repositoryOwner(raw.repository);
}
function forbiddenFindings(dir, options = {}) {
  const apps = options.apps ?? FORBIDDEN_APPS;
  const findings = [];
  const allowed = allowances(dir);
  const owner = packageOwner(dir);
  const used = /* @__PURE__ */ new Map();
  for (const path of walkFiles(dir, options.skip === void 0 ? {} : { skip: options.skip })) {
    const name = basename2(path);
    if (SKIPPED_FILES.has(name) || !isTextFile(path)) continue;
    const relative2 = relativePath(dir, path);
    if (relative2 === ALLOW_FILE) continue;
    const text = readText(path);
    if (text === void 0) continue;
    const exempt = relative2.endsWith("fixtures/conformance.json") ? grantTokens(text) : [];
    const withoutGrants = exempt.reduce((value, token) => value.split(token).join("<grant-token>"), text);
    if (relative2.endsWith("fixtures/conformance.json")) for (const finding of grantClaimFindings(relative2, text)) add(findings, used, allowed, finding);
    const lines = text.split(/\r?\n/);
    const scanLines = withoutGrants.split(/\r?\n/);
    const seen = /* @__PURE__ */ new Set();
    const reportedKinds = /* @__PURE__ */ new Set();
    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;
      for (const app of apps) {
        for (const match of line.matchAll(app.pattern)) {
          const at = match.index ?? 0;
          if (line.slice(Math.max(0, at - 2), at).toLowerCase() === "x-") continue;
          const key = `app:${lineNumber}:${app.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          add(findings, used, allowed, {
            id: "FORBIDDEN.app-name",
            level: "error",
            path: relative2,
            message: `line ${lineNumber} names the ${app.name} app; a plugin is host-neutral, and an app-only hint belongs in an x-<app> key`,
            fix: "remove the app name, or move the hint under an x-<app> key in capabilities"
          });
        }
      }
      for (const pattern of [MAIN_LINK, RAW_MAIN_LINK, SHORT_MAIN_LINK]) {
        const regex = new RegExp(pattern.source, pattern.flags);
        for (const match of line.matchAll(regex)) {
          if (owner === void 0 || match[1].toLowerCase() !== owner.toLowerCase()) continue;
          const key = `main:${lineNumber}`;
          if (seen.has(key)) continue;
          seen.add(key);
          add(findings, used, allowed, {
            id: "FORBIDDEN.main-branch",
            level: "error",
            path: relative2,
            message: `line ${lineNumber} links to the main branch of a repository under this plugin's owner; every repository in the org uses master`,
            fix: "point the link at master, not main"
          });
        }
      }
      const kinds = forbiddenSecretKinds(scanLines[index] ?? line);
      for (const kind of kinds) {
        reportedKinds.add(kind);
        const key = `secret:${lineNumber}:${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          id: "FORBIDDEN.secret",
          level: "error",
          path: relative2,
          message: `line ${lineNumber} holds what looks like a ${kind}; a committed file never carries one`,
          fix: "remove it, rotate it with the provider, and record the fixture again through plugin-kit record"
        });
      }
    }
    for (const kind of forbiddenSecretKinds(withoutGrants)) {
      const key = `whole:${kind}`;
      if (seen.has(key) || reportedKinds.has(kind)) continue;
      seen.add(key);
      add(findings, used, allowed, {
        id: "FORBIDDEN.secret",
        level: "error",
        path: relative2,
        message: `the file holds what looks like a ${kind}; a committed file never carries one`,
        fix: "remove it, rotate it with the provider, and record the fixture again through plugin-kit record"
      });
    }
  }
  for (const [allow, count] of used) {
    findings.push({
      id: "FORBIDDEN.suppressed",
      level: "warning",
      path: allow.path,
      message: `${allow.pattern} is suppressed for ${allow.path}${count > 1 ? ` (${count} matches)` : ""}: ${allow.reason}`
    });
  }
  return sortFindings(findings);
}
async function runForbidden(context) {
  const findings = forbiddenFindings(context.dir);
  print(context, findings, findings.length === 0 ? "forbidden: ok" : "forbidden: patterns found");
  return hasError(findings) ? 1 : 0;
}

// src/kit/check.ts
async function checkPlugin(context, options = {}) {
  const plugin = readPlugin(context.dir);
  const hosts2 = options.hosts === void 0 || options.hosts.length === 0 ? [] : [...options.hosts];
  const findings = [];
  try {
    const runner = await context.conformance();
    const report = await runner.runConformance(context.dir, hosts2.length === 0 ? {} : { hosts: hosts2 });
    findings.push(...report.findings);
  } catch (error) {
    findings.push({
      id: "KIT_CONFORMANCE",
      level: "error",
      message: `conformance did not run: ${error instanceof Error ? error.message : String(error)}`,
      fix: "fix the plugin or the installed plugin-contract, then run plugin-kit check again"
    });
  }
  if (plugin.manifest !== void 0) findings.push(...missingDocFiles(context.dir));
  findings.push(...forbiddenFindings(context.dir));
  findings.push(...bundledFindings(context.dir));
  return sortFindings(findings);
}
async function runCheck(context, options = {}) {
  const findings = await checkPlugin(context, options);
  if (context.json) {
    context.io.stdout(`${JSON.stringify({ command: "check", ok: !hasError(findings), findings }, null, 2)}
`);
    return hasError(findings) ? 1 : 0;
  }
  print(context, findings, hasError(findings) ? "check: failed" : "check: ok");
  return hasError(findings) ? 1 : 0;
}

// src/kit/conformance.ts
var REQUIRED = ["runConformance", "t0", "t1"];
async function loadConformance(importModule = () => import("./conformance.js")) {
  const module = await importModule();
  const runner = typeof module === "object" && module !== null ? module : {};
  const missing = REQUIRED.filter((name) => typeof runner[name] !== "function");
  if (missing.length > 0) {
    throw new KitError(
      "KIT_CONFORMANCE",
      `the installed plugin-contract publishes no ${missing.join(", ")} in its conformance module`,
      "install the plugin-contract version this plugin declares (v0.0.0 or later), which publishes runConformance, t0 and t1"
    );
  }
  return module;
}
async function runConformance(context, options = {}) {
  const runner = await context.conformance();
  const report = await runner.runConformance(context.dir, {
    ...options.hosts === void 0 || options.hosts.length === 0 ? {} : { hosts: options.hosts },
    ...options.record === true ? { record: true } : {}
  });
  if (context.json) {
    context.io.stdout(`${JSON.stringify(report, null, 2)}
`);
  } else {
    for (const finding of report.findings) printFinding(context, finding);
    context.io.stdout(`conformance: ${report.ok ? "ok" : "failed"} (${report.findings.length} finding${report.findings.length === 1 ? "" : "s"})
`);
  }
  return report.ok ? 0 : 1;
}

// src/kit/hosts.ts
var HOSTS = Object.freeze([TESTED_OPENCODE]);
function formatHosts(hosts2 = HOSTS) {
  return `[${hosts2.join(", ")}]`;
}
async function runHosts(context) {
  context.io.stdout(context.json ? `${JSON.stringify(HOSTS)}
` : `${formatHosts()}
`);
  return 0;
}

// src/kit/record.ts
import { join as join6 } from "node:path";
var PLACEHOLDER = {
  secret: "<redacted:secret>",
  email: "<redacted:email>",
  phone: "<redacted:phone>",
  home: "<redacted:home>",
  personal: "<redacted:personal>",
  query: "<redacted>"
};
var SECRET_KEY = /(?:(?:^|[_.-])(?:token|secret|password|passwd|pwd|apikey|api_key|api-key|authorization|cookie|credential|credentials|private_key|private-key|client_secret|client-secret|access_token|refresh_token)(?:$|[_.-])|^(?:accessToken|refreshToken|idToken|apiKey|clientSecret|privateKey|sessionToken|botToken)$)/i;
var PERSONAL_KEY = /^(?:e?mail|phone|phone_number|phoneNumber|mobile|address|username|user_name|login|display_name|displayName|real_name|realName|full_name|fullName|first_name|firstName|name)$/i;
function redactText(text) {
  if (secretKinds(text).length > 0) return PLACEHOLDER.secret;
  let result = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, PLACEHOLDER.email).replace(/(?<![\w+])\+\d[\d ().-]{5,}\d(?![\w])/g, (match) => {
    const digits = match.replace(/\D/g, "").length;
    return digits >= 8 && digits <= 15 ? PLACEHOLDER.phone : match;
  }).replace(/\/(?:home|Users)\/[A-Za-z0-9._/-]+/g, PLACEHOLDER.home);
  result = result.replace(/([?&](?:access_token|refresh_token|token|key|api_key|apikey|secret|client_secret|signature|sig|password|email|code)=)[^&#\s]+/gi, `$1${PLACEHOLDER.query}`);
  return result;
}
function isEvent(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof value["external_id"] === "string" && typeof value["hash"] === "string" && Array.isArray(value["actors"]);
}
var withoutHash = (event) => Object.fromEntries(Object.entries(event).filter(([key]) => key !== "hash"));
function redactFixture(value, options) {
  const redacted = redactValue(value, [], { publicKey: options.publicKey, verifiedTokens: options.verifiedTokens });
  const findings = [];
  const walk = (before, after, path) => {
    if (Array.isArray(before) && Array.isArray(after)) return after.map((item, index) => walk(before[index], item, path));
    if (typeof before !== "object" || before === null || Array.isArray(before)) return after;
    if (typeof after !== "object" || after === null || Array.isArray(after)) return after;
    const source = before;
    const result = after;
    for (const key of Object.keys(source)) result[key] = walk(source[key], result[key], [...path, key]);
    if (!isEvent(source) || !isEvent(result)) return result;
    const changed = JSON.stringify(withoutHash(source)) !== JSON.stringify(withoutHash(result));
    let valid = true;
    try {
      valid = eventHash(source) === source["hash"];
    } catch {
    }
    if (!valid) {
      findings.push({
        id: "RECORD.hash-mismatch",
        level: "error",
        path: options.display,
        message: `the event ${source["external_id"]} records a hash that does not match its pre-redaction content`,
        fix: "Record the fixture again from the provider; a wrong hash is not something redaction can repair."
      });
    }
    if (changed) {
      try {
        result["hash"] = eventHash(result);
      } catch {
      }
    }
    return result;
  };
  return { value: walk(value, redacted, []), findings };
}
function redactValue(value, path = [], context = {}) {
  if (path.length === 2 && path[0] === "grants" && path[1] === "cases" && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const token = value["token"];
    if (typeof token === "string" && context.verifiedTokens?.has(token) === true) return value;
  }
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, path, context));
  if (typeof value !== "object" || value === null) return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const keepsPublicKey = key === "publicKey" && path.length === 1 && path[0] === "grants" && item === context.publicKey;
    const keepsVerifiedToken = key === "token" && path.length === 2 && path[0] === "grants" && path[1] === "cases" && typeof item === "string" && context.verifiedTokens?.has(item) === true;
    if (keepsPublicKey || keepsVerifiedToken) {
      result[key] = item;
      continue;
    }
    if (SECRET_KEY.test(key)) {
      result[key] = PLACEHOLDER.secret;
      continue;
    }
    const keepsStatusName = key === "name" && path.length === 2 && path[0] === "events" && path[1] === "status";
    if (PERSONAL_KEY.test(key) && !keepsStatusName) {
      result[key] = PLACEHOLDER.personal;
      continue;
    }
    result[key] = redactValue(item, [...path, key], context);
  }
  return result;
}
var HOST_UNAVAILABLE = "T1.host-unavailable";
function recordReport(report) {
  const host = report.findings.filter((finding) => finding.id === HOST_UNAVAILABLE);
  if (host.length === 0) return { ok: report.ok, findings: [...report.findings] };
  const findings = report.findings.filter((finding) => finding.id !== HOST_UNAVAILABLE);
  findings.push({
    id: "RECORD.host-unavailable",
    level: "warning",
    path: "package.json",
    message: "the real host cannot run on this runtime (T1 needs Node 24 or Bun); the fixture was still recorded and redacted",
    fix: "Run plugin-kit check on Node 24 or Bun; record does not need the real host."
  });
  return { ok: !hasError(findings), findings };
}
var FIXTURE_FILE = "fixtures/conformance.json";
function fixtureAt(path, display) {
  const text = readText(path);
  if (text === void 0) {
    return { finding: { id: "RECORD.missing-file", level: "error", path: display, message: `${display} is missing`, fix: "the plugin's recorder must write fixtures/conformance.json before record can redact it" } };
  }
  try {
    const value = JSON.parse(text);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return { text, value };
  } catch {
  }
  return { finding: { id: "RECORD.invalid-json", level: "error", path: display, message: `${display} is not a JSON object`, fix: "record the fixture again; a recording writes a JSON object" } };
}
function fixtureAliases(value) {
  const accounts = value["accounts"];
  if (typeof accounts !== "object" || accounts === null) return [];
  const aliases = accounts["aliases"];
  return Array.isArray(aliases) ? aliases.filter((alias) => typeof alias === "string") : [];
}
async function runRecord(context, options) {
  const file = join6(context.dir, FIXTURE_FILE);
  const report = recordReport(options.check ? { ok: true, findings: [] } : await (await context.conformance()).runConformance(context.dir, { record: true }));
  const display = relativePath(context.dir, file);
  const read = fixtureAt(file, display);
  if ("finding" in read) {
    const findings2 = [...report.findings, read.finding];
    printResult(context, findings2, options, file, 0, report, "missing");
    return 1;
  }
  const aliases = fixtureAliases(read.value);
  if (options.account !== void 0 && !aliases.includes(options.account)) {
    throw new KitError("KIT_ACCOUNT_UNKNOWN", `the fixture records no account alias ${JSON.stringify(options.account)}`, `record one of ${aliases.length === 0 ? "the fixture's aliases" : aliases.join(", ")}, or pass --account with one of them`);
  }
  const redaction = redactFixture(read.value, { display, publicKey: fixturePublicKey(read.value), verifiedTokens: verifiedGrantTokens(read.value) });
  const redacted = redaction.value;
  const output = `${JSON.stringify(redacted, null, 2)}
`;
  const changed = output !== read.text;
  if (changed && !options.check) writeJsonIfChanged(file, redacted);
  const findings = [...report.findings, ...redaction.findings, ...changed && options.check ? [{ id: "RECORD.unredacted", level: "error", path: display, message: "the fixture still holds a secret or personal data", fix: "run plugin-kit record without --check and commit the redacted fixture" }] : []];
  printResult(context, findings, options, file, changed ? 1 : 0, report, changed ? options.check ? "needs redaction" : "redacted" : "unchanged");
  return report.ok && !hasError(findings) ? 0 : 1;
}
function printResult(context, findings, options, file, changed, report, state) {
  if (context.json) {
    context.io.stdout(`${JSON.stringify({ command: "record", ok: report.ok && !hasError(findings), account: options.account, fixture: relativePath(context.dir, file), changed, state, report, findings }, null, 2)}
`);
    return;
  }
  for (const finding of sortFindings(findings)) printFinding(context, finding);
  context.io.stdout(`record: ${relativePath(context.dir, file)} ${options.check ? "checked" : "written"}, ${state}; conformance ${options.check ? "not run (--check)" : report.ok ? "ok" : "failed"}
`);
}

// src/kit/release.ts
import { join as join7 } from "node:path";
var VERSION = /^0\.0\.\d+$/;
var tagOf = (version) => `v${version}`;
function isReleaseVersion(version) {
  return VERSION.test(version);
}
function hasChangelogSection(text, version) {
  return new RegExp(`^## \\[?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?(?:\\s|$)`, "m").test(text);
}
function prepared(plugin, version) {
  const findings = [];
  if (plugin.package.version !== version) {
    findings.push({
      id: "KIT_RELEASE.version",
      level: "error",
      path: "package.json",
      message: `package.json is version ${JSON.stringify(plugin.package.version)}, not the release version ${version}`,
      fix: `Prepare the release in its pull request: set package.json and package-lock.json to ${version}, then run release again.`
    });
  }
  const changelog = readText(join7(plugin.dir, "CHANGELOG.md"));
  if (changelog === void 0) {
    findings.push({ id: "KIT_RELEASE.changelog", level: "error", path: "CHANGELOG.md", message: "CHANGELOG.md is missing", fix: `Add a "## [${version}]" section in the release pull request.` });
  } else if (!hasChangelogSection(changelog, version)) {
    findings.push({ id: "KIT_RELEASE.changelog", level: "error", path: "CHANGELOG.md", message: `CHANGELOG.md has no "## [${version}]" section`, fix: `Add the section in the release pull request; release never invents one.` });
  }
  return findings;
}
async function git(context, args, what) {
  const answer = await context.git(args, context.dir);
  if (answer.code !== 0) throw new KitError("KIT_GIT", `${what} failed: ${answer.stderr.trim() || answer.stdout.trim() || `git ${args.join(" ")}`}`, "Resolve the repository state, then run release again.");
  return answer.stdout.trim();
}
async function guard(context) {
  const branch = await git(context, ["rev-parse", "--abbrev-ref", "HEAD"], "git rev-parse --abbrev-ref HEAD");
  if (branch !== "master") throw new KitError("KIT_RELEASE.branch", `the release runs on ${branch}, not master`, "Check out master and run release again; a tag on another branch is not a release.");
  const status = await git(context, ["status", "--porcelain"], "git status --porcelain");
  if (status !== "") throw new KitError("KIT_RELEASE.dirty", "the working tree has uncommitted changes", "Commit or stash them, then run release again.");
  const fetched = await context.git(["fetch", "--quiet", "origin", "master"], context.dir);
  if (fetched.code !== 0) throw new KitError("KIT_GIT", `git fetch origin master failed: ${fetched.stderr.trim() || fetched.stdout.trim()}`, "Check the remote, then run release again.");
  const head = await git(context, ["rev-parse", "HEAD"], "git rev-parse HEAD");
  const origin = await git(context, ["rev-parse", "origin/master"], "git rev-parse origin/master");
  if (head !== origin) throw new KitError("KIT_RELEASE.origin", "master is not level with origin/master", "Pull or push master so the two are equal, then run release again.");
}
async function runRelease(context, version, options) {
  if (!isReleaseVersion(version)) {
    throw new KitError("KIT_VERSION", `"${version}" is not a release version`, "pass 0.0.x, such as 0.0.0 or 0.0.1; the contract releases only the 0.0 line");
  }
  const plugin = readPlugin(context.dir);
  if (!Object.hasOwn(plugin.package, "capabilities")) {
    throw new KitError(
      "KIT_NOT_A_PLUGIN",
      `${plugin.name} has no capabilities, so it is not a plugin`,
      "run release from a plugin's root; this contract itself releases through scripts/release.mjs"
    );
  }
  const findings = [...await checkPlugin(context)];
  findings.push(...prepared(plugin, version));
  if (hasError(findings)) {
    if (context.json) context.io.stdout(`${JSON.stringify({ command: "release", ok: false, version, tag: tagOf(version), findings: sortFindings(findings) }, null, 2)}
`);
    else {
      for (const finding of sortFindings(findings)) printFinding(context, finding);
      context.io.stdout(`release: checks failed, so ${tagOf(version)} was not cut
`);
    }
    return 1;
  }
  await guard(context);
  const tag = tagOf(version);
  if (options.dryRun) {
    const answer2 = { command: "release", ok: true, version, tag, dryRun: true, findings };
    if (context.json) context.io.stdout(`${JSON.stringify(answer2, null, 2)}
`);
    else context.io.stdout(`release: would cut ${tag}; checks and guards passed, no tag written
`);
    return 0;
  }
  const tagged = await context.git(["tag", "-a", tag, "-m", tag], context.dir);
  if (tagged.code !== 0) throw new KitError("KIT_GIT", `git tag ${tag} failed: ${tagged.stderr.trim() || tagged.stdout.trim()}`, "Delete an existing local tag only if it is yours, then run release again.");
  const answer = { command: "release", ok: true, version, tag, dryRun: false, findings };
  if (context.json) context.io.stdout(`${JSON.stringify(answer, null, 2)}
`);
  else {
    for (const finding of sortFindings(findings)) printFinding(context, finding);
    context.io.stdout(`release: ${tag} cut locally; push the tag yourself to let CI publish the GitHub release
`);
  }
  return 0;
}

// src/kit/format.ts
function code(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}
function list(values, render = code) {
  if (values === void 0 || values.length === 0) return "\u2014";
  return values.map(render).join(", ");
}
function cadence(minutes) {
  if (minutes === void 0 || !Number.isFinite(minutes) || minutes <= 0) return "\u2014";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${Math.round(minutes)} min`;
  }
  const days = minutes / (60 * 24);
  return Number.isInteger(days) ? `${days} day${days === 1 ? "" : "s"}` : `${Math.round(minutes / 60)} hours`;
}

// src/kit/supported.ts
function writeClasses(manifest) {
  const order = ["write", "send", "share", "delete", "export", "admin"];
  const found = new Set(Object.values(manifest.methods).map((method) => method.class));
  return order.filter((value) => found.has(value));
}
var SUPPORTED_HEADERS = ["Plugin", "Repository", "Accounts (today \u2192 target)", "Sources (kind: reads/output)", "Write classes", "Signals", "Suggested cadence", "Wave", "Status"];
function supportedCells(manifest, repository, options = {}) {
  const accounts = accountsCell(manifest);
  const sources = manifest.sources.length === 0 ? "\u2014" : manifest.sources.map((source) => `${source.id} (${source.kind}: ${source.kind === "events" ? source.reads : source.output})`).join(", ");
  const signals = [...new Set(manifest.sources.flatMap((source) => source.signals ?? []))].sort();
  const minutes = manifest.sources.map((source) => source.cadence?.suggestMinutes).filter((value) => value !== void 0);
  const cadenceCell = minutes.length === 0 ? "\u2014" : cadence(Math.min(...minutes));
  return [manifest.plugin.name, `\`${repository}\``, accounts, sources, list(writeClasses(manifest), String), list(signals, String), cadenceCell, options.wave ?? "\u2014", options.status ?? "supported"];
}
function accountsCell(manifest) {
  const info = manifest.accounts;
  if (info === void 0) return "\u2014";
  return info.profile === void 0 ? info.via : `${info.via} (profile per alias)`;
}
function supportedRow(manifest, repository, options = {}) {
  return `| ${supportedCells(manifest, repository, options).join(" | ")} |`;
}
async function runSupported(context, options = {}) {
  const plugin = readPlugin(context.dir);
  const manifest = requireManifest(plugin);
  const cells = supportedCells(manifest, plugin.repository, options);
  if (context.json) {
    context.io.stdout(`${JSON.stringify({ headers: SUPPORTED_HEADERS, cells, row: supportedRow(manifest, plugin.repository, options) }, null, 2)}
`);
  } else {
    context.io.stdout(`${supportedRow(manifest, plugin.repository, options)}
`);
  }
  return 0;
}

// src/kit/cli.ts
var COMMANDS = ["check", "docs", "record", "conformance", "hosts", "release", "supported", "forbidden"];
var defaultGit = (args, directory) => new Promise((done) => {
  execFile("git", [...args], { cwd: directory, encoding: "utf8" }, (error, stdout, stderr) => {
    const numeric = error === null ? 0 : Number(error.code);
    const code2 = Number.isFinite(numeric) && numeric !== 0 ? numeric : error === null ? 0 : 1;
    done({ code: code2, stdout: stdout ?? "", stderr: stderr ?? "" });
  });
});
var HELP = `plugin-kit: the plugin contract's development kit

Usage: plugin-kit <command> [options]

Commands:
  check                     T0, T1 on every tested host, generated docs, forbidden patterns
  docs                      write the manifest-driven doc sections
  record                    record provider fixtures, then redact secrets and personal data
  conformance               run the whole conformance report
  hosts                     print the OpenCode release matrix
  release <version>         checks, changelog section, version, one commit and one tag
  supported                 print this plugin's SUPPORTED.md row
  forbidden                 check app names, main-branch links, secrets and grant emails

Options:
  --dir <path>              the plugin directory (default: the working directory)
  --json                    print one JSON object instead of a report
  --help                    this text, or a command's options
  --host <release>          a host for check or conformance (repeatable)
  --check                   report drift only (docs, record)
  --account <alias>         the account a recording belongs to
  --record                  record while running conformance
  --dry-run                 write nothing (release)
  --wave <name>             the SUPPORTED.md wave cell
  --status <state>          the SUPPORTED.md status cell
`;
var VALUE_FLAGS = /* @__PURE__ */ new Set(["dir", "host", "account", "wave", "status"]);
var BOOLEAN_FLAGS = /* @__PURE__ */ new Set(["json", "check", "record", "dry-run", "help"]);
function parse(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) return "help";
  let command;
  const positionals = [];
  const flags = /* @__PURE__ */ new Map();
  const set = (name, value) => {
    if (name === "host") {
      const hosts2 = flags.get(name) ?? [];
      flags.set(name, [...hosts2, String(value)]);
      return;
    }
    flags.set(name, value);
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      if (command === void 0) command = arg;
      else positionals.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? void 0 : equals);
    const inline = equals === -1 ? void 0 : arg.slice(equals + 1);
    if (BOOLEAN_FLAGS.has(name)) {
      if (inline !== void 0) throw usage(`--${name} takes no value`);
      flags.set(name, true);
      continue;
    }
    if (!VALUE_FLAGS.has(name)) throw usage(`--${name} is not an option`);
    const value = inline ?? argv[++index];
    if (value === void 0 || value.startsWith("--")) throw usage(`--${name} needs a value`);
    set(name, value);
  }
  if (command === void 0) return "help";
  if (!COMMANDS.includes(command)) throw usage(`"${command}" is not a command`);
  return { command, positionals, flags };
}
var usage = (what) => new KitError("KIT_USAGE", what, `run plugin-kit --help; commands are ${COMMANDS.join(", ")}`);
var flag = (parsed, name) => {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : void 0;
};
var bool = (parsed, name) => parsed.flags.get(name) === true;
var hosts = (parsed) => {
  const value = parsed.flags.get("host");
  return Array.isArray(value) ? value : [];
};
async function main(argv, options = {}) {
  const io = {
    stdout: options.stdout ?? ((text) => process.stdout.write(text)),
    stderr: options.stderr ?? ((text) => process.stderr.write(text))
  };
  const wantsJson = argv.includes("--json");
  let parsed;
  try {
    parsed = parse(argv);
  } catch (error) {
    if (wantsJson) io.stdout(`${JSON.stringify(errorObject(error), null, 2)}
`);
    else io.stderr(`${error instanceof Error ? error.message : String(error)}
`);
    return 2;
  }
  if (parsed === "help") {
    io.stdout(HELP);
    return 0;
  }
  const context = {
    dir: resolve(options.cwd ?? process.cwd(), flag(parsed, "dir") ?? "."),
    io,
    conformance: options.conformance ?? (() => loadConformance()),
    git: options.git ?? defaultGit,
    now: options.now ?? (() => /* @__PURE__ */ new Date()),
    json: bool(parsed, "json")
  };
  try {
    const command = parsed.command;
    if (command !== "release" && parsed.positionals.length > 0) throw usage(`${command} takes no positional arguments`);
    switch (command) {
      case "check":
        return await runCheck(context, { hosts: hosts(parsed) });
      case "docs":
        return await runDocs(context, { check: bool(parsed, "check") });
      case "record":
        return await runRecord(context, { account: flag(parsed, "account"), check: bool(parsed, "check") });
      case "conformance":
        return await runConformance(context, { hosts: hosts(parsed), record: bool(parsed, "record") });
      case "hosts":
        return await runHosts(context);
      case "release": {
        const version = parsed.positionals[0];
        if (version === void 0) throw usage("release needs a version, such as 0.0.0");
        if (parsed.positionals.length > 1) throw usage("release takes one version");
        return await runRelease(context, version, { dryRun: bool(parsed, "dry-run") });
      }
      case "supported":
        return await runSupported(context, { wave: flag(parsed, "wave"), status: flag(parsed, "status") });
      case "forbidden":
        return await runForbidden(context);
    }
  } catch (error) {
    if (context.json) io.stdout(`${JSON.stringify(errorObject(error), null, 2)}
`);
    else if (error instanceof KitError) io.stderr(`${error.message}
`);
    else io.stderr(`KIT_INTERNAL: ${error instanceof Error ? error.message : String(error)}. Next step: run plugin-kit --help, and report this with the plugin directory.
`);
    return error instanceof KitError ? error.code === "KIT_USAGE" ? 2 : 1 : 1;
  }
}
function errorObject(error) {
  if (error instanceof KitError) return { ok: false, error: { code: error.code, message: error.what, next: error.next } };
  return {
    ok: false,
    error: {
      code: "KIT_INTERNAL",
      message: error instanceof Error ? error.message : String(error),
      next: "run plugin-kit --help, and report this with the plugin directory"
    }
  };
}
export {
  COMMANDS,
  HELP,
  KIT_BUNDLE_MARKER,
  KitError,
  TurnLog,
  automationApi,
  checkPlugin,
  connectMcpServer,
  createAutomation,
  createCodeMode,
  createHost,
  forbiddenFindings,
  loadConformance,
  main,
  mcpAddress,
  redactText,
  redactValue,
  waitForActivation
};
