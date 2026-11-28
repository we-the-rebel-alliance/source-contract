// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  isEventKind
} from "./chunk-RUQH3YH7.js";
import {
  validator
} from "./chunk-P2QQJNQB.js";
import {
  _enum,
  array,
  object,
  string
} from "./chunk-AYJEC7Y2.js";

// src/hints.ts
var HINT_MAX = 1500;
var HINT_KEYS = ["source", "kinds", "produces"];
var FORBIDDEN_HINT_KEYS = ["apply", "stated_by", "space", "budget", "priority"];
var PRODUCES_TYPES = ["commitment", "decision", "fact", "preference", "constraint", "person", "project"];
var PRODUCES_LIST = "commitment, decision, fact, preference, constraint, person or project";
var SOURCE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
var KEY = /^[a-z][a-z0-9_]*$/;
var producesType = _enum(PRODUCES_TYPES, { error: `must be a knowledge type (${PRODUCES_LIST})` });
var kind = string().max(64).refine(isEventKind, { error: "must be an event kind, such as meeting or x-<namespace>/<name>" });
var sourceId = string().max(64).regex(SOURCE_ID, { error: "must be a source id such as acme.meetings" });
var hintFrontmatter = object({
  source: sourceId.describe("One of the plugin's own source ids."),
  kinds: array(kind, { error: "must be a list such as [meeting]" }).min(1, "must name at least one kind"),
  produces: array(producesType, { error: "must be a list such as [commitment]" }).min(1, "must name at least one type").optional()
}).strict();
var HINT_SCHEMA = validator("hint", hintFrontmatter);
function scalar(raw) {
  const text = raw.trim();
  if (text.startsWith('"') || text.startsWith("'")) {
    const quote = text[0];
    if (text.length < 2 || !text.endsWith(quote)) return { ok: false };
    return { ok: true, value: text.slice(1, -1).replaceAll(`\\${quote}`, quote) };
  }
  if (text.startsWith("[") || text.startsWith("{")) return { ok: false };
  return { ok: true, value: text };
}
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote !== "") {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "{") depth++;
    else if (char === "]" || char === "}") depth--;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}
function parseValue(raw) {
  const text = raw.trim();
  if (text.startsWith("[") && text.endsWith("]")) {
    const inner = text.slice(1, -1);
    const items = [];
    for (const part of splitTop(inner)) {
      const parsed = scalar(part);
      if (!parsed.ok) return parsed;
      items.push(parsed.value);
    }
    return { ok: true, value: items };
  }
  if (text.startsWith("{") && text.endsWith("}")) {
    const inner = text.slice(1, -1);
    const entries = {};
    for (const part of splitTop(inner)) {
      const colon = part.indexOf(":");
      if (colon <= 0) return { ok: false };
      const key = part.slice(0, colon).trim();
      if (!KEY.test(key)) return { ok: false };
      const parsed = parseValue(part.slice(colon + 1));
      if (!parsed.ok) return parsed;
      entries[key] = parsed.value;
    }
    return { ok: true, value: entries };
  }
  return scalar(text);
}
function parseFrontmatter(text, what = "file") {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return { ok: false, problems: [`the ${what} must begin with its frontmatter: --- on a line of its own`] };
  const close = lines.findIndex((line, index) => index > 0 && line === "---");
  if (close === -1) return { ok: false, problems: [`the ${what} has no closing --- line for its frontmatter`] };
  const frontmatter = {};
  const problems = [];
  for (const [index, line] of lines.slice(1, close).entries()) {
    const at = index + 2;
    if (line.trim() === "") continue;
    if (/^[\s]/.test(line)) {
      problems.push(`the ${what}'s frontmatter line ${at} is indented: the frontmatter is one key a line`);
      continue;
    }
    const colon = line.indexOf(":");
    const key = colon === -1 ? "" : line.slice(0, colon).trim();
    if (colon <= 0 || !KEY.test(key)) {
      problems.push(`the ${what}'s frontmatter line ${at} is not a key and its value`);
      continue;
    }
    if (Object.hasOwn(frontmatter, key)) {
      problems.push(`the ${what}'s frontmatter line ${at} repeats the key "${key}"`);
      continue;
    }
    const parsed = parseValue(line.slice(colon + 1));
    if (!parsed.ok) {
      problems.push(`the ${what}'s frontmatter line ${at} holds a value this contract does not read`);
      continue;
    }
    frontmatter[key] = parsed.value;
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { frontmatter, body: lines.slice(close + 1).join("\n").trim() } };
}
function keyProblems(frontmatter, known, forbidden, what, why) {
  const problems = [];
  for (const key of Object.keys(frontmatter)) {
    if (known.includes(key)) continue;
    if (forbidden.includes(key)) problems.push(`the ${what} sets "${key}", which a ${what} may not set: ${why}`);
    else problems.push(`the ${what} has the key "${key}", which a ${what} does not have (${known.join(", ")})`);
  }
  return problems;
}
var HINT_WHY = "a hint is data, and the consumer decides how its text is used";
function hintProblems(text, options) {
  if (typeof text !== "string") return ["the hint is not text"];
  const problems = [];
  if (text.length > HINT_MAX) problems.push(`the hint is ${text.length} characters, over the ${HINT_MAX} a hint may take`);
  const parsed = parseFrontmatter(text, "hint");
  if (!parsed.ok) return [...problems, ...parsed.problems];
  const keys = keyProblems(parsed.value.frontmatter, HINT_KEYS, FORBIDDEN_HINT_KEYS, "hint", HINT_WHY);
  if (keys.length > 0) return [...problems, ...keys];
  const checked = HINT_SCHEMA.check(parsed.value.frontmatter);
  if (!checked.ok) return [...problems, ...checked.problems];
  if (!options.sources.includes(checked.value.source)) problems.push(`the hint names the source "${checked.value.source}", which is not one of the plugin's own`);
  return problems;
}

export {
  HINT_MAX,
  HINT_KEYS,
  FORBIDDEN_HINT_KEYS,
  PRODUCES_TYPES,
  HINT_SCHEMA,
  parseFrontmatter,
  hintProblems
};
