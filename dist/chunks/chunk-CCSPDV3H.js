// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  fromJSONSchema
} from "./chunk-AYJEC7Y2.js";

// src/accounts/alias.ts
var DEFAULT_ALIAS = "default";
var ALIAS_PATTERN = /^[a-z][a-z0-9]{0,31}$/;
function isAlias(value) {
  return typeof value === "string" && ALIAS_PATTERN.test(value);
}
function aliasProblem(value, where = "the account alias") {
  if (typeof value !== "string") return `${where} must be a string`;
  if (!ALIAS_PATTERN.test(value)) return `${where} must match ${ALIAS_PATTERN.source}: one lowercase letter, then up to 31 lowercase letters or digits`;
  return void 0;
}

// src/accounts/names.ts
function accountName(plugin, alias) {
  if (!isAlias(alias)) throw new Error(`accounts: "${alias}" is not an account alias`);
  return alias === DEFAULT_ALIAS ? plugin : `${plugin}-${alias}`;
}
function accountLabel(title, alias) {
  return alias === DEFAULT_ALIAS ? title : `${title} (${alias})`;
}

// src/accounts/profiles.ts
import { hostname, userInfo } from "node:os";
var plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function localIdentity(identity = {}) {
  const user = identity.user ?? safeUser();
  const host = identity.host ?? safeHost();
  return `os-user:${user}@${host}`;
}
function safeUser() {
  try {
    const user = userInfo().username;
    if (user) return user;
  } catch {
  }
  return process.env["USER"] ?? "unknown";
}
function safeHost() {
  try {
    const host = hostname();
    if (host) return host;
  } catch {
  }
  return "unknown";
}
function profileSchema(manifest) {
  const properties = manifest.options["properties"];
  if (!plain(properties)) return void 0;
  const accounts = properties["accounts"];
  if (!plain(accounts)) return void 0;
  const additional = accounts["additionalProperties"];
  return plain(additional) || typeof additional === "boolean" ? additional : void 0;
}
function profileProblems(schema, profile, alias) {
  if (schema === void 0) return [`options.accounts.${alias}: the manifest declares no profile schema`];
  let validator;
  try {
    validator = fromJSONSchema(schema);
  } catch {
    return [`options.accounts.${alias}: the manifest's profile schema is not a JSON Schema this package can check`];
  }
  const result = validator.safeParse(profile);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => `options.accounts.${alias}.${[...issue.path, key].join(".")}: is not a profile field the plugin declares`);
    }
    return [`options.accounts.${alias}${issue.path.length === 0 ? "" : `.${issue.path.join(".")}`}: ${issue.message}`];
  });
}
function accountsOf(manifest, options = {}) {
  const declared = manifest.accounts;
  if (declared === void 0) return { ok: true, value: { plugin: manifest.plugin.name, mechanism: void 0, accounts: [] } };
  const problems = [];
  const raw = options["accounts"];
  if (raw !== void 0 && !plain(raw)) return { ok: false, problems: ["options.accounts: must be a map of alias to profile"] };
  const entries = raw === void 0 ? [] : Object.entries(raw);
  if (declared.via === "local" && entries.some(([alias]) => alias !== DEFAULT_ALIAS)) {
    problems.push("options.accounts: a local plugin has one account, named default");
  }
  const profiles = [];
  if (entries.length === 0) {
    profiles.push({ alias: DEFAULT_ALIAS, ...declared.via === "local" ? { identity: localIdentity() } : {} });
  } else {
    const schema = profileSchema(manifest);
    for (const [alias, value] of entries) {
      const bad = aliasProblem(alias, `options.accounts.${alias}`);
      if (bad !== void 0) {
        problems.push(bad);
        continue;
      }
      if (!plain(value)) {
        problems.push(`options.accounts.${alias}: must be an object`);
        continue;
      }
      problems.push(...profileProblems(schema, value, alias));
      profiles.push({ alias, profile: value, ...declared.via === "local" ? { identity: localIdentity() } : {} });
    }
  }
  return problems.length === 0 ? { ok: true, value: { plugin: manifest.plugin.name, mechanism: declared.via, accounts: profiles } } : { ok: false, problems };
}
function hasAccount(plan, alias) {
  return isAlias(alias) && plan.accounts.some((account) => account.alias === alias);
}

// src/accounts/register.ts
var message = (error) => error instanceof Error ? error.message : String(error);
async function registerAccounts(context, request) {
  const plan = accountsOf(request.manifest, request.options ?? {});
  if (!plan.ok) return { mechanism: request.manifest.accounts?.via, accounts: [], problems: plan.problems };
  const { mechanism, accounts } = plan.value;
  if (mechanism === void 0) return { mechanism, accounts: [], problems: [] };
  const registered = accounts.map((account) => ({ alias: account.alias, name: accountName(plan.value.plugin, account.alias) }));
  if (mechanism === "local") return { mechanism, accounts: registered, problems: [] };
  const problems = [];
  if (mechanism === "integration") {
    if (request.auth === void 0) {
      return { mechanism, accounts: registered, problems: ["accounts: the integration mechanism needs auth methods for each alias"] };
    }
    try {
      await context.integration.transform((raw) => {
        const editor = raw;
        for (const account of accounts) {
          const id = accountName(plan.value.plugin, account.alias);
          try {
            editor.update(id, (integration) => {
              integration.name = accountLabel(request.manifest.plugin.title, account.alias);
            });
            for (const method of request.auth?.(account, id) ?? []) {
              editor.method.update({ ...method, integrationID: id });
            }
          } catch (error) {
            problems.push(`accounts.${account.alias}: the integration ${id} could not be registered: ${message(error)}`);
          }
        }
      });
    } catch (error) {
      problems.push(`accounts: the integration transform failed: ${message(error)}`);
    }
    return { mechanism, accounts: registered, problems };
  }
  if (request.server === void 0) {
    return { mechanism, accounts: registered, problems: ["accounts: the mcp mechanism needs a server config for each alias"] };
  }
  try {
    await context.mcp.transform((raw) => {
      const editor = raw;
      for (const account of accounts) {
        const name = accountName(plan.value.plugin, account.alias);
        try {
          editor.set(name, request.server(account, name));
        } catch (error) {
          problems.push(`accounts.${account.alias}: the MCP server ${name} could not be registered: ${message(error)}`);
        }
      }
    });
  } catch (error) {
    problems.push(`accounts: the MCP transform failed: ${message(error)}`);
  }
  return { mechanism, accounts: registered, problems };
}

// src/accounts/resolve.ts
function listOf(aliases) {
  if (aliases.length === 0) return "none";
  if (aliases.length === 1) return aliases[0];
  return `${aliases.slice(0, -1).join(", ")} or ${aliases.at(-1)}`;
}
function resolveAccount(accounts, input = {}) {
  const aliases = accounts.map((account) => account.alias);
  const named = input.account;
  if (named !== void 0 && named !== null) {
    if (typeof named !== "string" || !aliases.includes(named)) {
      return {
        ok: false,
        code: "ACCOUNT_UNKNOWN",
        what: typeof named === "string" ? `this plugin has no account "${named}"` : "account must be an alias, such as work",
        next: aliases.length === 0 ? "Leave account out: this plugin signs in to no accounts." : `Pass account, one of: ${aliases.join(", ")}.`
      };
    }
    return { ok: true, alias: named };
  }
  if (accounts.length === 0) return { ok: true, alias: DEFAULT_ALIAS };
  if (accounts.length === 1) return { ok: true, alias: accounts[0].alias };
  return {
    ok: false,
    code: "ACCOUNT_REQUIRED",
    what: `this plugin has ${accounts.length} accounts and the call names none`,
    next: `Pass account, one of: ${aliases.join(", ")}.`
  };
}
function aliasesSentence(accounts) {
  return `Pass account, one of: ${listOf(accounts.map((account) => account.alias))}.`;
}

// src/accounts/status.ts
var ACCOUNT_STATES = ["ready", "needs_sign_in", "error"];
var REASON_MAX = 160;
function redactReason(reason) {
  if (typeof reason !== "string" || reason.length === 0) return "No reason was given.";
  let text = reason.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().replace(/([?&][^=\s&]+)=[^&\s]*/g, "$1=\u2026").replace(/\b(Bearer|Basic)\s+\S+/gi, "$1 \u2026").replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "\u2026").replace(/\b(?:sk|pk|rk|ghp|gho|ghs|xox[abp])[-_][A-Za-z0-9_-]{12,}\b/g, "\u2026").replace(/\b[A-Za-z0-9_-]{40,}\b/g, "\u2026");
  if (text.length === 0) text = "No reason was given.";
  if (text.length > REASON_MAX) {
    let end = REASON_MAX - 1;
    const code = text.charCodeAt(end - 1);
    if (end > 0 && code >= 55296 && code <= 56319) end--;
    text = `${text.slice(0, end)}\u2026`;
  }
  return text;
}
function accountStatus(alias, signal) {
  if (signal === void 0) return { alias, state: "needs_sign_in", reason: "Not signed in yet." };
  return {
    alias,
    state: signal.state,
    ...signal.owner === void 0 ? {} : { owner: signal.owner },
    ...signal.state === "ready" || signal.reason === void 0 ? {} : { reason: redactReason(signal.reason) }
  };
}
function accountStatuses(accounts, signals = {}) {
  if (accounts.length === 0) return [];
  return accounts.map((account) => accountStatus(account.alias, signals[account.alias]));
}
var NO_ACCOUNTS = [];
var SIGN_IN_NEXT = "Sign in to the account that needs it, then read status again.";
function statusAnswer(input) {
  const problems = [...input.problems ?? []];
  const unguarded = input.unguardedAgents;
  if (!unguarded.ok) problems.push(unguarded.error);
  const needsSignIn = input.accounts.some((account) => account.state === "needs_sign_in");
  return {
    name: input.manifest.plugin.name,
    version: input.version,
    host: { version: input.hostVersion, range: input.manifest.plugin.host.opencode, tested: [...input.manifest.plugin.host.tested] },
    state: problems.length > 0 ? "error" : needsSignIn ? "needs_sign_in" : "ready",
    accounts: [...input.accounts],
    unguardedAgents: unguarded.ok ? [...unguarded.agents] : [],
    nextStep: problems.length > 0 ? redactReason(problems[0]) : needsSignIn ? SIGN_IN_NEXT : null
  };
}
var STATUS_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    host: {
      type: "object",
      properties: {
        version: { type: "string", minLength: 1 },
        range: { type: "string", minLength: 1 },
        tested: { type: "array", minItems: 1, items: { type: "string" } }
      },
      required: ["version", "range", "tested"],
      additionalProperties: false
    },
    state: { type: "string", enum: [...ACCOUNT_STATES] },
    accounts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          alias: { type: "string", minLength: 1 },
          state: { type: "string", enum: [...ACCOUNT_STATES] },
          owner: { type: "object", additionalProperties: true },
          reason: { type: "string", maxLength: REASON_MAX }
        },
        required: ["alias", "state"],
        additionalProperties: false
      }
    },
    unguardedAgents: { type: "array", items: { type: "string" } },
    nextStep: {}
  },
  required: ["name", "version", "host", "state", "accounts", "unguardedAgents", "nextStep"],
  additionalProperties: false
};

export {
  DEFAULT_ALIAS,
  ALIAS_PATTERN,
  isAlias,
  aliasProblem,
  accountName,
  accountLabel,
  localIdentity,
  accountsOf,
  hasAccount,
  registerAccounts,
  resolveAccount,
  aliasesSentence,
  ACCOUNT_STATES,
  REASON_MAX,
  redactReason,
  accountStatus,
  accountStatuses,
  NO_ACCOUNTS,
  statusAnswer,
  STATUS_SCHEMA
};
