// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  canonicalScope
} from "./chunk-UP4MI2EO.js";
import {
  ACCESS_LEVELS,
  accessLevel,
  effectFor
} from "./chunk-AMT4OSAU.js";
import {
  COST_CLASSES,
  METHOD_ACCOUNTS,
  METHOD_CLASSES,
  METHOD_EFFECTS
} from "./chunk-RUQH3YH7.js";
import {
  validator
} from "./chunk-P2QQJNQB.js";
import {
  _enum,
  array,
  boolean,
  iso_exports,
  literal,
  number,
  record,
  strictObject,
  string,
  union
} from "./chunk-AYJEC7Y2.js";

// src/audit/report.ts
var auditAccess = _enum(["runs", "asks first", "off"]);
var auditScope = record(string(), union([string(), array(string())]));
var price = strictObject({ per: string().min(1), usd: number().finite().nonnegative() });
var cost = strictObject({ class: _enum(COST_CLASSES), units: array(price).min(1).optional() });
var grantBinding = strictObject({
  consumer: string().min(1),
  account: string().min(1),
  scope: auditScope,
  manifestHash: string().min(1),
  disabled: boolean(),
  person: string().min(1),
  grantedAt: iso_exports.datetime({ offset: true }),
  stale: literal(true).optional()
}).describe("One grant behind a source or an action, and the binding the person consented to.");
var auditMethod = strictObject({
  method: string().min(1),
  class: _enum(METHOD_CLASSES),
  effect: _enum(METHOD_EFFECTS).optional(),
  access: auditAccess
});
var auditSource = strictObject({
  id: string().min(1),
  method: string().min(1),
  operations: array(string()),
  accounts: _enum(METHOD_ACCOUNTS),
  private: boolean(),
  cost,
  grants: array(grantBinding)
});
var auditAction = strictObject({
  id: string().min(1),
  preview: string().min(1),
  commit: string().min(1),
  operations: array(string()),
  confirmation: _enum(["required", "optional"]),
  grants: array(grantBinding)
});
var auditPlugin = strictObject({
  package: string().min(1),
  version: string().min(1),
  manifestHash: string().min(1),
  access: _enum(ACCESS_LEVELS),
  sources: array(auditSource),
  actions: array(auditAction),
  methods: array(auditMethod)
});
var auditProblem = strictObject({ problem: string().min(1), grant: grantBinding });
var auditReportSchema = strictObject({ person: string().min(1), plugins: array(auditPlugin), problems: array(auditProblem) }).describe("What each installed plugin may read and do for one person, and the grant behind each declaration.");
var AUDIT_SCHEMA = validator("audit", auditReportSchema);
function accessOf(effect) {
  return effect === "allow" ? "runs" : effect === "ask" ? "asks first" : "off";
}
function operationsOf(...methods) {
  const seen = /* @__PURE__ */ new Set();
  const operations = [];
  for (const method of methods) {
    for (const operation of method?.operations ?? []) {
      if (seen.has(operation)) continue;
      seen.add(operation);
      operations.push(operation);
    }
  }
  return operations;
}
function methodOf(name, item, level) {
  return {
    method: name,
    class: item.class,
    ...item.effect === void 0 ? {} : { effect: item.effect },
    access: accessOf(effectFor(item, level))
  };
}
function scopeOf(grant) {
  const scope = "scope" in grant ? grant.scope : void 0;
  try {
    return canonicalScope(scope);
  } catch {
    return scope ?? {};
  }
}
function bindingOf(grant, installedHash) {
  return {
    consumer: grant.consumer,
    account: grant.account,
    scope: scopeOf(grant),
    manifestHash: grant.manifestHash,
    disabled: grant.disabled ?? false,
    person: grant.person,
    grantedAt: grant.grantedAt,
    ...installedHash !== void 0 && grant.manifestHash !== installedHash ? { stale: true } : {}
  };
}
function levelOf(input, installed) {
  const raw = input.access?.[installed.manifest.plugin.name];
  const checked = accessLevel(raw === void 0 ? {} : { access: raw });
  if (!checked.ok) throw new Error(`audit: the access level for ${installed.manifest.plugin.name} is invalid: ${checked.problems.join("; ")}`);
  return checked.value;
}
function reportOf(installed, level) {
  const manifest = installed.manifest;
  const method = (name) => manifest.methods[name];
  return {
    package: installed.package,
    version: installed.version,
    manifestHash: installed.hash,
    access: level,
    sources: manifest.sources.map((source) => ({
      id: source.id,
      method: source.method,
      operations: [...source.operations ?? []],
      accounts: method(source.method)?.accounts ?? "none",
      private: source.private ?? false,
      cost: {
        class: source.cost.class,
        ...source.cost.units === void 0 ? {} : { units: source.cost.units.map((unit) => ({ per: unit.per, usd: unit.usd })) }
      },
      grants: []
    })),
    actions: manifest.actions.map((action) => ({
      id: action.id,
      preview: action.preview,
      commit: action.commit,
      operations: operationsOf(method(action.preview), method(action.commit)),
      confirmation: action.effect === "local" ? "optional" : "required",
      grants: []
    })),
    methods: Object.entries(manifest.methods).map(([name, item]) => methodOf(name, item, level))
  };
}
function isActGrant(grant) {
  return typeof grant.action === "string";
}
var pluginOf = (id) => id.split(".")[0] ?? id;
function auditReport(input) {
  const contexts = input.plugins.map((installed) => ({ installed, report: reportOf(installed, levelOf(input, installed)) }));
  const byName = /* @__PURE__ */ new Map();
  for (const context of contexts) byName.set(context.installed.manifest.plugin.name, context);
  const problems = [];
  for (const grant of input.grants ?? []) {
    const act = isActGrant(grant);
    const id = act ? grant.action : grant.source;
    if (typeof id !== "string" || id === "") {
      problems.push({ problem: "the grant names neither a source nor an action", grant: bindingOf(grant) });
      continue;
    }
    const context = byName.get(pluginOf(id));
    const binding = bindingOf(grant, context?.installed.hash);
    if (context === void 0) {
      problems.push({ problem: `the plugin "${pluginOf(id)}" is not installed`, grant: binding });
      continue;
    }
    if (act) {
      const action = context.report.actions.find((entry) => entry.id === grant.action);
      if (action === void 0) {
        problems.push({
          problem: `the action "${grant.action}" is not declared by ${context.installed.package} ${context.installed.version}`,
          grant: binding
        });
        continue;
      }
      action.grants.push(binding);
      continue;
    }
    const source = context.report.sources.find((entry) => entry.id === grant.source);
    if (source === void 0) {
      problems.push({
        problem: `the source "${grant.source}" is not declared by ${context.installed.package} ${context.installed.version}`,
        grant: binding
      });
      continue;
    }
    source.grants.push(binding);
  }
  return { person: input.person, plugins: contexts.map((context) => context.report), problems };
}

export {
  AUDIT_SCHEMA,
  auditReport
};
