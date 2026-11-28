// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  validator
} from "./chunk-P2QQJNQB.js";
import {
  secretKinds
} from "./chunk-M7EFVHR5.js";
import {
  _enum,
  json,
  literal,
  record,
  strictObject,
  string
} from "./chunk-AYJEC7Y2.js";

// src/telemetry/definition.ts
var TELEMETRY_FIELD_CLASSES = ["metadata", "personal", "content"];
var TELEMETRY_EVENT_CLASSES = ["event", "audit"];
var PLUGIN_EVENT_TYPES = [
  "plugin.read",
  "plugin.plan",
  "plugin.commit",
  "plugin.refused",
  "account.signed_in",
  "account.signed_out",
  "account.needs_sign_in"
];
function eventType(name, version) {
  return `${name}.v${version}`;
}
function catalogueEvents(catalogue) {
  if ("events" in catalogue) return catalogue.events;
  return catalogue;
}
function catalogueEvent(catalogue, type, version) {
  return catalogueEvents(catalogue).find((event) => event.type === type && event.version === version);
}
function declared(event) {
  return Object.freeze({ ...event, fields: Object.freeze({ ...event.fields }) });
}
var CALL_FIELDS = {
  method: { class: "metadata" },
  method_class: { class: "metadata" },
  effect: { class: "metadata" },
  account: { class: "metadata" },
  consumer: { class: "metadata" },
  allowed_by: { class: "metadata" },
  outcome: { class: "metadata" },
  duration_ms: { class: "metadata" }
};
var ACCOUNT_FIELDS = {
  account: { class: "metadata" },
  state: { class: "metadata" },
  reason: { class: "metadata", optional: true }
};
var TELEMETRY_CATALOGUE = Object.freeze([
  declared({
    type: "plugin.read",
    version: 1,
    class: "audit",
    note: "A read through a door returned, with the count of events and the provider's cost.",
    fields: {
      ...CALL_FIELDS,
      count: { class: "metadata" },
      cost_usd: { class: "metadata", optional: true }
    }
  }),
  declared({
    type: "plugin.plan",
    version: 1,
    class: "audit",
    note: "A planning call returned a plan, without writing anything.",
    fields: CALL_FIELDS
  }),
  declared({
    type: "plugin.commit",
    version: 1,
    class: "audit",
    note: "A commit ran the plan it was given.",
    fields: CALL_FIELDS
  }),
  declared({
    type: "plugin.refused",
    version: 1,
    class: "audit",
    note: "A call was refused before it reached the provider, with the code that explains why.",
    fields: CALL_FIELDS
  }),
  declared({
    type: "account.signed_in",
    version: 1,
    class: "audit",
    note: "An account signed in and became ready.",
    fields: ACCOUNT_FIELDS
  }),
  declared({
    type: "account.signed_out",
    version: 1,
    class: "audit",
    note: "An account signed out.",
    fields: ACCOUNT_FIELDS
  }),
  declared({
    type: "account.needs_sign_in",
    version: 1,
    class: "audit",
    note: "An account needs a person to sign in again.",
    fields: ACCOUNT_FIELDS
  })
]);

// src/telemetry/envelope.ts
import { randomUUID } from "node:crypto";

// src/telemetry/subject.ts
var SUBJECT_KEYS = ["person", "agent", "session", "trace"];
var TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
var ZERO = /^0+$/;
var TRACE_ID = /^[0-9a-f]{32}$/;
function text(value, where) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${where} is not a non-empty string`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`${where} carries a control character`);
  return value;
}
function isTraceparent(value) {
  if (typeof value !== "string") return false;
  const match = TRACEPARENT.exec(value);
  if (match === null) return false;
  const [, version, traceId, spanId] = match;
  return version !== "ff" && !ZERO.test(traceId) && !ZERO.test(spanId);
}
function traceIdOf(traceparent) {
  return isTraceparent(traceparent) ? TRACEPARENT.exec(traceparent)?.[2] : void 0;
}
function subjectString(subject) {
  if (subject === void 0) return void 0;
  for (const key of Object.keys(subject)) {
    if (!SUBJECT_KEYS.includes(key)) {
      throw new TypeError(`subject.${key} is not person, agent, session or trace`);
    }
  }
  const parts = [];
  for (const key of SUBJECT_KEYS) {
    const value = subject[key];
    if (value === void 0) continue;
    parts.push(`${key}=${encodeURIComponent(text(value, `subject.${key}`))}`);
  }
  return parts.length === 0 ? void 0 : parts.join(";");
}
function parseSubject(subject) {
  if (subject === void 0) return { ok: true, value: {} };
  const value = {};
  const problems = [];
  for (const part of subject.split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) {
      problems.push(`subject: "${part}" is not key=value`);
      continue;
    }
    const key = part.slice(0, at);
    const raw = part.slice(at + 1);
    if (!SUBJECT_KEYS.includes(key)) {
      problems.push(`subject.${key}: is not person, agent, session or trace`);
      continue;
    }
    if (Object.hasOwn(value, key)) {
      problems.push(`subject.${key}: is named more than once`);
      continue;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      problems.push(`subject.${key}: is not percent-encoded text`);
      continue;
    }
    if (decoded === "" || /[\u0000-\u001f\u007f]/.test(decoded)) {
      problems.push(`subject.${key}: is not a non-empty id`);
      continue;
    }
    value[key] = decoded;
  }
  if (problems.length > 0) return { ok: false, problems };
  const trace = value["trace"];
  if (trace !== void 0 && (!TRACE_ID.test(trace) || ZERO.test(trace))) {
    return { ok: false, problems: ["subject.trace: is not a W3C trace id"] };
  }
  return { ok: true, value };
}

// src/telemetry/schema.ts
var EVENT_NAME = "[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+";
var EVENT_TYPE = new RegExp(`^${EVENT_NAME}\\.v[1-9][0-9]*$`);
var SOURCE = /^plugin:\/\/[^/\s?#]+\/[^/\s?#]+\/[^/\s?#]+$/;
var FIELD_NAME = /^[a-z][a-z0-9_]*$/;
var TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
var TRACEPARENT2 = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/;
var SUBJECT_PART = "(?:person|agent|session|trace)=[^;=\\s]+";
var SUBJECT = new RegExp(`^${SUBJECT_PART}(?:;${SUBJECT_PART})*$`);
var field = strictObject({
  class: _enum([...TELEMETRY_FIELD_CLASSES]),
  value: json()
});
var envelope = strictObject({
  specversion: literal("1.0"),
  id: string().min(1).max(200).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), { error: "must not carry a control character" }),
  time: string().regex(TIME, { error: "must be an ISO 8601 UTC time, such as 2026-11-28T10:00:00.000Z" }),
  type: string().regex(EVENT_TYPE, { error: "must be an event name and version, such as plugin.read.v1" }),
  source: string().regex(SOURCE, { error: "must be plugin://<component>/<version>/<deployment>" }),
  subject: string().regex(SUBJECT, { error: "must be person=\u2026;agent=\u2026;session=\u2026;trace=\u2026" }).optional(),
  traceparent: string().regex(TRACEPARENT2, { error: "must be a W3C traceparent" }).refine(isTraceparent, { error: "must name a real trace and span" }).optional(),
  datacontenttype: literal("application/json"),
  data: record(string().regex(FIELD_NAME, { error: "must be a lowercase field name" }), field)
});
var TELEMETRY_EVENT_SCHEMA = validator("telemetry.event", envelope);

// src/telemetry/validate.ts
var SECRET_NAME = /^(?:(?:api|access|secret|private|signing|session)[_-]?key|apikey|secret|client[_-]?secret|password|passwd|passphrase|access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer|authorization|cookie|set[_-]?cookie|credentials?|private[_-]?key)$/i;
function secretProblems(event) {
  const problems = [];
  const check = (value, where) => {
    let text3;
    try {
      text3 = JSON.stringify(value);
    } catch {
      problems.push(`${where}: is not JSON`);
      return;
    }
    const kind = secretKinds(text3)[0];
    if (kind !== void 0) problems.push(`${where}: holds a ${kind}, and a secret is never captured`);
  };
  for (const [name, entry] of Object.entries(event.data)) {
    if (SECRET_NAME.test(name)) problems.push(`data.${name}: the field name is secret-shaped`);
    check(entry.value, `data.${name}`);
  }
  check(event.id, "id");
  check(event.source, "source");
  if (event.subject !== void 0) check(event.subject, "subject");
  return problems;
}
function validateEvent(event, catalogue = TELEMETRY_CATALOGUE) {
  const envelope2 = TELEMETRY_EVENT_SCHEMA.check(event);
  if (!envelope2.ok) return envelope2;
  const parsed = envelope2.value;
  const problems = [];
  const declared2 = catalogueEvents(catalogue).find((candidate) => `${candidate.type}.v${candidate.version}` === parsed.type);
  if (declared2 === void 0) {
    return { ok: false, problems: [`type: "${parsed.type}" is not in the catalogue`] };
  }
  if (!TELEMETRY_EVENT_CLASSES.includes(declared2.class)) {
    problems.push(`catalogue.${declared2.type}: "${String(declared2.class)}" is not an event class`);
  }
  const fieldNames = new Set(Object.keys(declared2.fields));
  for (const [name, field2] of Object.entries(declared2.fields)) {
    if (!TELEMETRY_FIELD_CLASSES.includes(field2.class)) {
      problems.push(`catalogue.${declared2.type}.${name}: "${String(field2.class)}" is not a field class`);
    }
    if (!Object.hasOwn(parsed.data, name) && field2.optional !== true) {
      problems.push(`data.${name}: is missing, and ${parsed.type} declares it`);
    }
  }
  for (const [name, entry] of Object.entries(parsed.data)) {
    const field2 = declared2.fields[name];
    if (field2 === void 0 || !fieldNames.has(name)) {
      problems.push(`data.${name}: is not declared in ${parsed.type}, so it has no class`);
      continue;
    }
    if (entry.class !== field2.class) {
      problems.push(`data.${name}: has class ${entry.class}, not ${field2.class}`);
    }
  }
  const subject = parseSubject(parsed.subject);
  if (!subject.ok) {
    problems.push(...subject.problems);
  } else if (subject.value.trace !== void 0 && parsed.traceparent !== void 0 && subject.value.trace !== traceIdOf(parsed.traceparent)) {
    problems.push("subject.trace: names a different trace from traceparent");
  }
  problems.push(...secretProblems(parsed));
  return problems.length === 0 ? { ok: true, value: parsed } : { ok: false, problems };
}

// src/telemetry/envelope.ts
function text2(value, where) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`telemetry: ${where} is not a non-empty string`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new TypeError(`telemetry: ${where} carries a control character`);
  return value;
}
function sourceString(source) {
  if (typeof source !== "object" || source === null) throw new TypeError("telemetry: source names the component, version and deployment");
  const component = encodeURIComponent(text2(source.component, "source.component"));
  const version = encodeURIComponent(text2(source.version, "source.version"));
  const deployment = encodeURIComponent(text2(source.deployment, "source.deployment"));
  return `plugin://${component}/${version}/${deployment}`;
}
function eventTime(value) {
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("telemetry: time is not a date");
  return date.toISOString();
}
function createEvent(input) {
  const catalogue = input.catalogue ?? TELEMETRY_CATALOGUE;
  const version = input.version ?? 1;
  const declared2 = catalogueEvent(catalogue, input.type, version);
  if (declared2 === void 0) throw new TypeError(`telemetry: ${eventType(input.type, version)} is not in the catalogue`);
  if (typeof input.fields !== "object" || input.fields === null || Array.isArray(input.fields)) {
    throw new TypeError(`telemetry: ${eventType(input.type, version)} fields is not an object`);
  }
  const fields = input.fields;
  for (const [name, field2] of Object.entries(declared2.fields)) {
    if (!Object.hasOwn(fields, name) && field2.optional !== true) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)} declares ${name} and the event leaves it out`);
    }
    if (Object.hasOwn(fields, name) && fields[name] === void 0 && field2.optional !== true) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)}.${name} has no value`);
    }
  }
  for (const name of Object.keys(fields)) {
    if (!Object.hasOwn(declared2.fields, name)) {
      throw new TypeError(`telemetry: ${eventType(input.type, version)} does not declare ${name}`);
    }
  }
  const data = {};
  for (const [name, field2] of Object.entries(declared2.fields)) {
    if (!Object.hasOwn(fields, name)) continue;
    const value = fields[name];
    if (value === void 0 && field2.optional === true) continue;
    data[name] = { class: field2.class, value };
  }
  let subject = input.subject;
  if (input.traceparent !== void 0) {
    if (!isTraceparent(input.traceparent)) throw new TypeError("telemetry: traceparent is not a W3C traceparent");
    const trace = traceIdOf(input.traceparent);
    if (subject?.trace === void 0 && trace !== void 0) subject = { ...subject, trace };
  }
  const subjectText = subjectString(subject);
  const event = {
    specversion: "1.0",
    id: input.id === void 0 ? randomUUID() : text2(input.id, "id"),
    time: eventTime(input.time),
    type: eventType(declared2.type, declared2.version),
    source: sourceString(input.source),
    ...subjectText === void 0 ? {} : { subject: subjectText },
    ...input.traceparent === void 0 ? {} : { traceparent: input.traceparent },
    datacontenttype: "application/json",
    data
  };
  const checked = validateEvent(event, catalogue);
  if (!checked.ok) throw new TypeError(`telemetry: ${eventType(declared2.type, declared2.version)} is not valid:
- ${checked.problems.join("\n- ")}`);
  return checked.value;
}

// src/telemetry/log.ts
import { closeSync, existsSync, fchmodSync, fstatSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
function syncDirectory(directory) {
  let fd;
  try {
    fd = openSync(directory, "r");
    fsyncSync(fd);
  } catch {
  } finally {
    if (fd !== void 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
function repairTornTail(path) {
  let fd;
  try {
    fd = openSync(path, "r+");
  } catch {
    return;
  }
  try {
    const size = fstatSync(fd).size;
    if (size === 0) return;
    const last = Buffer.alloc(1);
    readSync(fd, last, 0, 1, size - 1);
    if (last[0] === 10) return;
    let end = size;
    let truncate = 0;
    while (end > 0) {
      const start = Math.max(0, end - 64 * 1024);
      const chunk = Buffer.alloc(end - start);
      readSync(fd, chunk, 0, chunk.length, start);
      const found = chunk.lastIndexOf(10);
      if (found !== -1) {
        truncate = start + found + 1;
        break;
      }
      end = start;
    }
    ftruncateSync(fd, truncate);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function createEventLog(options) {
  if (typeof options?.path !== "string" || options.path.trim() === "") throw new TypeError("telemetry: the event log needs a path");
  const path = resolve(options.path);
  const catalogue = options.catalogue ?? TELEMETRY_CATALOGUE;
  return {
    path,
    append(event) {
      let checked;
      try {
        checked = validateEvent(event, catalogue);
      } catch {
        return { ok: false, reason: "invalid", problems: ["the event could not be read"] };
      }
      if (!checked.ok) return { ok: false, reason: "invalid", problems: checked.problems };
      let line;
      try {
        line = `${JSON.stringify(checked.value)}
`;
      } catch {
        return { ok: false, reason: "invalid", problems: ["the event is not JSON"] };
      }
      try {
        mkdirSync(dirname(path), { recursive: true, mode: 448 });
        repairTornTail(path);
        const created = !existsSync(path);
        const fd = openSync(path, "a", 384);
        try {
          try {
            fchmodSync(fd, 384);
          } catch {
          }
          const bytes = Buffer.from(line);
          let offset = 0;
          while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        if (created) syncDirectory(dirname(path));
        return { ok: true, id: checked.value.id };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
    read() {
      try {
        const text3 = readFileSync(path, "utf8");
        const lines = text3.split("\n");
        if (lines.at(-1) === "") lines.pop();
        const events = [];
        for (const line of lines) {
          if (line === "") continue;
          try {
            const value = JSON.parse(line);
            const checked = validateEvent(value, catalogue);
            if (checked.ok) events.push(checked.value);
          } catch {
          }
        }
        return events;
      } catch {
        return [];
      }
    }
  };
}

export {
  TELEMETRY_FIELD_CLASSES,
  TELEMETRY_EVENT_CLASSES,
  PLUGIN_EVENT_TYPES,
  eventType,
  catalogueEvents,
  catalogueEvent,
  TELEMETRY_CATALOGUE,
  TELEMETRY_EVENT_SCHEMA,
  validateEvent,
  createEvent,
  createEventLog
};
