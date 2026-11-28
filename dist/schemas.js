// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  TELEMETRY_EVENT_SCHEMA
} from "./chunks/chunk-5QNU63MF.js";
import {
  HINT_SCHEMA
} from "./chunks/chunk-CAO5NJGO.js";
import {
  AUDIT_SCHEMA
} from "./chunks/chunk-4CLPVV4N.js";
import "./chunks/chunk-UP4MI2EO.js";
import "./chunks/chunk-AMT4OSAU.js";
import {
  MANIFEST_SCHEMA
} from "./chunks/chunk-YOSR7DZV.js";
import {
  OUTPUTS
} from "./chunks/chunk-UY2FWVSQ.js";
import {
  ATTENDANCE_RESPONSES,
  COMMITMENT_STATES,
  EVENT_LIMITS
} from "./chunks/chunk-RUQH3YH7.js";
import "./chunks/chunk-7KJXMIQH.js";
import {
  validator
} from "./chunks/chunk-P2QQJNQB.js";
import "./chunks/chunk-M7EFVHR5.js";
import "./chunks/chunk-CCSPDV3H.js";
import {
  _enum,
  boolean,
  literal,
  object,
  string
} from "./chunks/chunk-AYJEC7Y2.js";
import "./chunks/chunk-WLRWVIVP.js";

// src/internal/schema/facts.ts
var actorId = string().min(1).max(EVENT_LIMITS.actorId).describe("An actor id on the same event.");
var httpsUrl = string().max(EVENT_LIMITS.url).refine((value) => /^https:\/\/\S+$/.test(value), { error: "must be an https URL" });
var commitment = object({
  type: literal("commitment"),
  key: string().min(1).max(EVENT_LIMITS.factKey).describe("A stable id of this commitment within the source and account."),
  title: string().min(1).max(EVENT_LIMITS.factTitle),
  owner: actorId,
  counterparty: actorId.optional(),
  due: string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "must be a date such as 2026-11-30" }).optional(),
  state: _enum(COMMITMENT_STATES),
  url: httpsUrl.optional()
}).strict();
var personAttribute = object({
  type: literal("person.attribute"),
  actor: actorId,
  org: string().min(1).max(EVENT_LIMITS.factAttribute).optional(),
  team: string().min(1).max(EVENT_LIMITS.factAttribute).optional(),
  role: string().min(1).max(EVENT_LIMITS.factAttribute).optional()
}).strict().refine((value) => value.org !== void 0 || value.team !== void 0 || value.role !== void 0, {
  error: "must name org, team or role: a person's attribute comes from structured profile or directory data"
}).describe("A person's attribute, from structured profile or directory data only: at least one of org, team or role.");
var meetingAttended = object({
  type: literal("meeting.attended"),
  actor: actorId,
  response: _enum(ATTENDANCE_RESPONSES),
  organizer: boolean()
}).strict();
var FACT_SCHEMAS = {
  commitment: validator("fact.commitment", commitment),
  "person.attribute": validator("fact.person.attribute", personAttribute),
  "meeting.attended": validator("fact.meeting.attended", meetingAttended)
};

// src/schemas.ts
var SCHEMAS = [
  MANIFEST_SCHEMA,
  ...Object.values(OUTPUTS),
  ...Object.values(FACT_SCHEMAS),
  HINT_SCHEMA,
  AUDIT_SCHEMA,
  TELEMETRY_EVENT_SCHEMA
];
export {
  SCHEMAS
};
