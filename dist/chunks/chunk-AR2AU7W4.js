// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  canonicalScope
} from "./chunk-UP4MI2EO.js";
import {
  ACCESS_LEVELS,
  accessLevel,
  effectFor
} from "./chunk-QRQ6DMVY.js";
import {
  COST_CLASSES,
  METHOD_ACCOUNTS,
  METHOD_CLASSES,
  METHOD_EFFECTS
} from "./chunk-RUQH3YH7.js";
import {
  validator
} from "./chunk-FTEX4OOT.js";
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
} from "./chunk-4YITQAYJ.js";

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

// src/audit/render.ts
var LINE_BREAK = /\r\n|\r|\n/g;
function cell(value) {
  return value.replace(LINE_BREAK, "<br>").replaceAll("|", "\\|");
}
function line(value) {
  return value.replace(LINE_BREAK, " ");
}
function list(values) {
  return values.length === 0 ? "none" : cell(values.join(", "));
}
function scopeText(scope) {
  return JSON.stringify(scope);
}
function grantText(grant) {
  const marks = [grant.stale ? "stale" : "", grant.disabled ? "disabled" : ""].filter((mark) => mark !== "");
  const suffix = marks.length === 0 ? "" : ` (${marks.join(", ")})`;
  return `${grant.consumer} on ${grant.account}, scope ${scopeText(grant.scope)}, granted ${grant.grantedAt} by ${grant.person}${suffix}`;
}
function costText(cost2) {
  const units = cost2.units ?? [];
  if (units.length === 0) return cost2.class;
  return `${cost2.class}: ${units.map((unit) => `${unit.usd} USD per ${unit.per}`).join("; ")}`;
}
function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`)
  ];
}
function renderAuditReport(report) {
  const lines = [`# Audit report for ${line(report.person)}`, ""];
  for (const plugin of report.plugins) {
    lines.push(`## ${line(plugin.package)} ${line(plugin.version)}`, "");
    lines.push(`Manifest: ${line(plugin.manifestHash)}`, `Access: ${line(plugin.access)}`, "");
    lines.push("### Methods", "");
    const methods = plugin.methods.map((method) => [
      cell(method.method),
      cell(method.class),
      cell(method.effect ?? "none"),
      cell(method.access)
    ]);
    lines.push(...table(["Method", "Class", "Declared effect", "Access"], methods), "");
    lines.push("### What it may read", "");
    if (plugin.sources.length === 0) {
      lines.push("No sources.", "");
    } else {
      const rows = [];
      for (const source of plugin.sources) {
        const declared = [
          cell(source.id),
          cell(source.method),
          list(source.operations),
          cell(source.accounts),
          source.private ? "yes" : "no",
          cell(costText(source.cost))
        ];
        if (source.grants.length === 0) rows.push([...declared, "no grant"]);
        else for (const grant of source.grants) rows.push([...declared, cell(grantText(grant))]);
      }
      lines.push(...table(["Source", "Method", "Operations", "Accounts", "Private", "Cost", "Grant"], rows), "");
    }
    lines.push("### What it may do", "");
    if (plugin.actions.length === 0) {
      lines.push("No actions.", "");
    } else {
      const rows = [];
      for (const action of plugin.actions) {
        const declared = [
          cell(action.id),
          cell(action.preview),
          cell(action.commit),
          list(action.operations),
          cell(action.confirmation)
        ];
        if (action.grants.length === 0) rows.push([...declared, "no grant"]);
        else for (const grant of action.grants) rows.push([...declared, cell(grantText(grant))]);
      }
      lines.push(...table(["Action", "Preview", "Commit", "Operations", "Confirmation", "Grant"], rows), "");
    }
  }
  lines.push("## Problems", "");
  if (report.problems.length === 0) {
    lines.push("No problems.");
  } else {
    for (const problem of report.problems) {
      lines.push(`- **problem:** ${line(problem.problem)}. ${line(grantText(problem.grant))}`);
    }
  }
  return `${lines.join("\n").replace(/\n+$/, "")}
`;
}

export {
  AUDIT_SCHEMA,
  auditReport,
  renderAuditReport
};
