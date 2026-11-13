/**
 * The rules a JSON Schema cannot express, carried from Memory's connector kit into contract version 1.
 *
 * Everything here is a conformance check, not a schema: the read-verb allowlist, the verb and joiner lists, the
 * namespace an action must be in, the `urlHosts` suffix rules, and the uniqueness a JSON Schema cannot state. The
 * generated JSON Schema (`dist/schemas/sources.json`) carries every shape it can; each rule here says why it cannot.
 */
import { SOURCES_SCHEMA } from "../../schema.ts"
import { PUBLIC_SUFFIX_RULES } from "./public-suffix-list.ts"
import type { Detail, SourceItem } from "../schema/types.ts"

/** A tool the plugin declares, as its manifest lists it. */
export interface ToolDeclaration {
  readonly id: string
  /** True when the tool reads and never changes anything. §2.2: every tool a source names is declared read-only. */
  readonly readOnly?: boolean | undefined
}

/** What `declarationProblems` needs beyond the declaration itself. */
export interface DeclarationOptions {
  /** The plugin's declared tools, so a named tool can be checked. Omit it when the list is not at hand. */
  readonly tools?: readonly ToolDeclaration[] | undefined
}

/**
 * The verbs a read may be named with, as tokens of a name: `get`, `list`, `read`, `search`, `query`, `fetch`, `count`,
 * `describe`, `probe`, `export`, `instances`, `status`, `lookup`, `view`, `history`, `find`.
 *
 * `export` and `instances` are reads here because a provider's own operation says so (`drive.files.export`,
 * `calendar.events.instances`). A plugin whose write tool is named `export` is still a write: the declaration says
 * `readOnly: true` for a read, and that is what conformance checks.
 */
export const READ_VERBS: readonly string[] = ["get", "list", "read", "search", "query", "fetch", "count", "describe", "probe", "export", "instances", "status", "lookup", "view", "history", "find"]

/**
 * The verbs that change something or send something out, as tokens. A name is refused when its own verb is one of
 * these; a write word in an object position is fine (`get_issue`, `list_deleted_items`).
 *
 * One string split at load, so the list is one line of data: a bundled array of quoted words would put "import" beside a
 * quote, and `npm run check:dist` reads that as an import statement.
 */
const WRITE_VERB_WORDS = `send create update delete write post remove add set schedule upload download archive unarchive move merge close reopen approve reject share invite react draft complete run exec execute edit patch put push commit comment reply message broadcast follow block mute pin unpin star assign label lock trash forward dispatch clear flush reset truncate overwrite apply join leave ban toggle kick unban grant revoke transfer promote demote rename duplicate restore purge wipe drop attach detach notify escalate resolve decline cancel submit vote snooze dismiss acknowledge ack enable disable connect disconnect login logout signin signout mint issue verify hide unhide publish unpublish ingest index reindex sync import save like unlike generate mark bookmark print convert insert modify watch untrash empty mention subscribe unsubscribe subscribe pause resume retry rollback`

export const WRITE_VERBS: readonly string[] = WRITE_VERB_WORDS.split(" ")

/** Tokens that join two actions in one name (`get_and_save`, `getAndSend`): a name is one action. */
export const JOINERS: readonly string[] = ["and", "then", "or"]

const READ = new Set(READ_VERBS)
const WRITE = new Set(WRITE_VERBS)
const JOIN = new Set(JOINERS)

const isVerb = (token: string): boolean => READ.has(token) || WRITE.has(token)

/**
 * A name split into tokens: on snake, kebab, dot and space, and at each camelCase boundary. `getAndSend` is
 * `get and send`, `gmail.users.messages.get` is `gmail users messages get`, and `batchGet` is `batch get`.
 */
export function tokensOf(name: unknown): string[] {
  return String(name ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[._\-\s]+/)
    .filter((token) => token !== "")
    .map((token) => token.toLowerCase())
}

/** Why a name joins two actions, or undefined when it names one. */
function joinerProblem(name: string, tokens: readonly string[]): string | undefined {
  for (let index = 1; index < tokens.length - 1; index++) {
    const token = tokens[index] ?? ""
    const next = tokens[index + 1] ?? ""
    if (JOIN.has(token) && isVerb(next)) return `"${name}" joins two actions with "${token}": name the one action it is`
  }
  return undefined
}

/** The first token of a name that is a verb, with its index, or undefined when the name has none. */
function firstVerb(tokens: readonly string[]): { readonly verb: string; readonly index: number } | undefined {
  for (const [index, token] of tokens.entries()) if (isVerb(token)) return { verb: token, index }
  return undefined
}

/**
 * Why a name is not a read's, or undefined when it is one.
 *
 * The name's own verb is the first token that is a verb: a read verb makes it a read, a write verb refuses it. The verb's
 * position is not fixed, because a name may put it after a namespace (`events_list`, `slack_read_channel`) or lead with
 * it (`get_issue`). A write word in an object position is no verb at all here (`get_issue` is a read of an issue). A name
 * with no verb is a noun name (`calendar_today`), which §2.2's own tools allow.
 */
export function nameProblem(name: unknown): string | undefined {
  if (typeof name !== "string" || name.length === 0) return "a read must be named"
  const tokens = tokensOf(name)
  const joiner = joinerProblem(name, tokens)
  if (joiner !== undefined) return joiner
  const verb = firstVerb(tokens)
  if (verb !== undefined && WRITE.has(verb.verb)) return `"${name}" carries the write verb ${verb.verb} where the name should carry the read's own verb`
  return undefined
}

/** `nameProblem`, and the name must carry a read verb. Memory's stricter form, for a read a consumer names. */
export function readVerbProblem(name: unknown): string | undefined {
  const problem = nameProblem(name)
  if (problem !== undefined) return problem
  const verb = firstVerb(tokensOf(name))
  if (verb === undefined) return `"${String(name)}" carries no read verb (${READ_VERBS.join(", ")})`
  return undefined
}

/**
 * Why an operation is not a read's, or undefined when it is one.
 *
 * A dotted operation (`gmail.users.messages.get`) is a provider call, and its last segment is where its verb sits: the
 * first token of that segment that is a verb must be a read verb, so `insert`, `batchModify`, `watch`, `untrash` and
 * `emptyTrash` are refused without being listed, while `batchGet`, `export` and `instances` are reads. A bare operation
 * (`slack_read_channel`) is an MCP tool name and follows the same rule. An operation with no verb at all is refused: an
 * operation names how it reads.
 */
export function operationProblem(operation: unknown): string | undefined {
  if (typeof operation !== "string" || operation.length === 0) return "an operation must be named"
  const joiner = joinerProblem(operation, tokensOf(operation))
  if (joiner !== undefined) return joiner
  const segment = operation.includes(".") ? (operation.split(".").pop() ?? "") : operation
  const verb = firstVerb(tokensOf(segment))
  if (verb === undefined) return `"${operation}" carries no read verb in "${segment}" (${READ_VERBS.join(", ")}): a read never sends, changes or watches`
  if (WRITE.has(verb.verb)) return `"${operation}" carries the write verb ${verb.verb} in "${segment}": a read never sends, changes or watches`
  return undefined
}

/** Every field of a contract-1 event. */
export const EVENT_FIELDS: readonly string[] = ["external_id", "kind", "occurred_at", "title", "text", "url", "thread", "actors", "labels", "hash"]

/** The event fields a `details` entry may take its input from: identifiers, never an event's own prose. */
export const DETAIL_FIELDS: readonly string[] = ["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"]

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const words = (name: unknown): string[] => String(name ?? "").toLowerCase().split(/[._-]+/).filter(Boolean)
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

/** The hosts anyone can claim. */
const SHARED_HOSTS = new Set([
  "cloudfront.net", "amazonaws.com", "storage.googleapis.com", "blob.core.windows.net", "web.core.windows.net",
  "herokuapp.com", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "github.io", "githubusercontent.com",
  "gitlab.io", "bitbucket.io", "appspot.com", "firebaseapp.com", "web.app", "azurewebsites.net", "elasticbeanstalk.com",
  "onrender.com", "railway.app", "fly.dev", "deno.dev", "glitch.me", "repl.co", "surge.sh", "ngrok.io", "r2.dev",
  "blogspot.com", "blogspot.co.uk", "blogspot.de", "blogspot.in", "wordpress.com", "wixsite.com", "translate.goog",
  "ipfs.io", "dweb.link", "bit.ly", "tinyurl.com",
])

/** The measurement and advertising hosts a collected link never points at. */
const TRACKER_HOSTS = new Set([
  "doubleclick.net", "google-analytics.com", "googletagmanager.com", "googleadservices.com", "googlesyndication.com",
  "2mdn.net", "facebook.net", "scorecardresearch.com", "criteo.com", "taboola.com", "outbrain.com", "adnxs.com",
  "hotjar.com", "segment.io", "mixpanel.com", "amplitude.com", "quantserve.com", "moatads.com", "adsrvr.org",
  "casalemedia.com", "rubiconproject.com", "pubmatic.com", "openx.net", "clarity.ms", "branch.io", "appsflyer.com",
  "adjust.com", "kochava.com", "smartadserver.com", "teads.tv", "yieldmo.com", "bat.bing.com",
])

/** The Public Suffix List's rules, as the data file holds them. */
const PSL = new Set(PUBLIC_SUFFIX_RULES)

/**
 * The public suffix of a host, from the full Public Suffix List (ICANN and PRIVATE): the longest matching rule, where
 * `*.` matches one label and `!` is an exception. `a.b.co.uk` answers `co.uk`, and `shop.ondigitalocean.app` answers
 * `ondigitalocean.app`, because the PRIVATE section says so.
 */
export function publicSuffixOf(host: string): string | null {
  const labels = host.toLowerCase().split(".")
  for (let index = 0; index < labels.length; index++) {
    const candidate = labels.slice(index).join(".")
    if (PSL.has(`!${candidate}`)) {
      const exception = labels.slice(index + 1).join(".")
      return exception === "" ? null : exception
    }
  }
  for (let index = 0; index < labels.length; index++) {
    const candidate = labels.slice(index).join(".")
    if (PSL.has(candidate)) return candidate
    const parent = labels.slice(index + 1).join(".")
    if (parent !== "" && PSL.has(`*.${parent}`)) return candidate
  }
  return null
}

/**
 * Why a `urlHosts` pattern is too broad to mean anything, or null when it is fine.
 *
 * `urlHosts` is display hygiene: a consumer renders an event's `url` only when its host matches, so a pattern that
 * names a public suffix, a host anyone can claim, a tracker or a punycode lookalike would let collected text become a
 * remote image or a tracking link.
 */
export function urlHostProblem(host: unknown): string | null {
  if (typeof host !== "string" || !/^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    return "is not a host pattern (a domain such as slack.com, or *.slack.com)"
  }
  const bare = host.toLowerCase().replace(/^\*\./, "")
  if (bare.split(".").some((label) => label.startsWith("xn--"))) return "is a punycode host (a label starting xn--), which hides what it is"
  const suffix = publicSuffixOf(bare)
  if (suffix === null) return "names no public suffix (its top-level domain is not in the Public Suffix List)"
  if (suffix === bare) return `is a public suffix (${bare}), which names no site`
  for (const listed of SHARED_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a shared host (${listed}), which anyone can claim`
  for (const listed of TRACKER_HOSTS) if (bare === listed || bare.endsWith(`.${listed}`)) return `is a tracker (${listed}), which is no source's destination`
  return null
}

/**
 * Every problem with a `sources` declaration: the validator's first, then the rules it cannot express.
 *
 * @param sources the value of the top-level `sources` key
 * @param options the plugin's declared tools, when they are at hand
 */
export function declarationProblems(sources: unknown, options: DeclarationOptions = {}): string[] {
  const checked = SOURCES_SCHEMA.check(sources)
  const problems = checked.ok ? [] : [...checked.problems]
  if (!plain(sources)) return problems
  const items = Array.isArray(sources["items"]) ? (sources["items"] as unknown[]) : []
  const tools = options.tools
  const toolOf = (id: string): ToolDeclaration | undefined => tools?.find((tool) => tool.id === id)

  const ids = items.filter(isSourceItem).map((item) => item.id)
  for (const id of unique(ids)) {
    if (ids.filter((entry) => entry === id).length > 1) problems.push(`items: two sources share the id "${id}": a source id is unique`)
  }

  for (const [index, item] of items.entries()) {
    if (!isSourceItem(item)) continue
    const at = `items[${index}] (${item.id})`
    const head = item.id.split(".")[0] ?? item.id

    for (const named of itemTools(item)) {
      const verb = nameProblem(named.name)
      if (verb !== undefined) problems.push(`${at}.${named.where}: ${verb}`)
      if (tools !== undefined) {
        const declared = toolOf(named.name)
        if (declared === undefined) problems.push(`${at}.${named.where} names "${named.name}", which the plugin does not declare`)
        else if (declared.readOnly !== true) problems.push(`${at}.${named.where} names "${named.name}", which is not declared readOnly: true`)
      }
    }

    const action = item.kind === "events" ? item.permission.events : item.permission.tool
    if (!action.startsWith(`${head}.`) && !action.startsWith(`${head}_`)) {
      problems.push(`${at}.permission.${item.kind === "events" ? "events" : "tool"} "${action}" is not in the plugin's namespace "${head}"`)
    }
    const verb = nameProblem(action)
    if (verb !== undefined) problems.push(`${at}.permission.${item.kind === "events" ? "events" : "tool"}: ${verb}`)

    for (const operation of item.permission.operations) {
      const problem = operationProblem(operation)
      if (problem !== undefined) problems.push(`${at}.permission.operations: ${problem}`)
    }
    for (const operation of unique(item.permission.operations)) {
      if (item.permission.operations.filter((entry) => entry === operation).length > 1) {
        problems.push(`${at}.permission.operations lists "${operation}" twice: an operation is granted once`)
      }
    }

    const details = item.kind === "events" ? (item.details ?? []) : []
    for (const [i, detail] of details.entries()) {
      const where = `${at}.details[${i}]`
      if (!detail.id.startsWith(`${head}.`)) problems.push(`${where}.id "${detail.id}" does not start with the plugin's namespace "${head}."`)
      for (const field of detail.from) {
        const name: string = field
        if (name === "title" || name === "text") {
          problems.push(`${where}.from names "${name}", which is item text: a detail's input comes only from an event's identifiers`)
        } else if (!EVENT_FIELDS.includes(name)) {
          problems.push(`${where}.from names "${name}", which is not an event field (${EVENT_FIELDS.join(", ")})`)
        }
      }
      for (const field of unique(detail.from)) {
        if (detail.from.filter((entry) => entry === field).length > 1) problems.push(`${where}.from names "${field}" twice`)
      }
    }
    for (const id of unique(details.map((entry) => entry.id))) {
      if (details.filter((entry) => entry.id === id).length > 1) problems.push(`${at}.details has two entries with the id "${id}"`)
    }

    const scope = item.scope
    if (scope !== undefined) {
      for (const key of unique(scope.keys)) {
        if (scope.keys.filter((entry) => entry === key).length > 1) problems.push(`${at}.scope.keys names "${key}" twice`)
      }
      const suggest = scope.suggest
      if (suggest !== undefined) {
        if (tools !== undefined) {
          const declared = toolOf(suggest.tool)
          if (declared === undefined) problems.push(`${at}.scope.suggest names "${suggest.tool}", which the plugin does not declare`)
          else if (declared.readOnly !== true) problems.push(`${at}.scope.suggest names "${suggest.tool}", which is not declared readOnly: true`)
        }
        for (const operation of suggest.operations) {
          const problem = operationProblem(operation)
          if (problem !== undefined) problems.push(`${at}.scope.suggest.operations: ${problem}`)
          if (item.permission.operations.includes(operation)) {
            problems.push(`${at}.scope.suggest.operations lists "${operation}", which permission.operations also lists: a bind-time read must not enter the running grant`)
          }
        }
        for (const operation of unique(suggest.operations)) {
          if (suggest.operations.filter((entry) => entry === operation).length > 1) problems.push(`${at}.scope.suggest.operations lists "${operation}" twice`)
        }
      }
    }

    for (const host of item.urlHosts ?? []) {
      const problem = urlHostProblem(host)
      if (problem !== null) problems.push(`${at}.urlHosts has ${JSON.stringify(host)}, which ${problem}`)
    }
  }
  return problems
}

/** `declarationProblems`, for a test or a check: throws one error listing every problem. */
export function assertDeclaration(sources: unknown, options: DeclarationOptions = {}): void {
  const problems = declarationProblems(sources, options)
  if (problems.length > 0) {
    throw new Error(`SCHEMA_VIOLATION: the sources declaration breaks contract version 1. Next step: fix each problem listed.\n- ${problems.join("\n- ")}`)
  }
}

/** Every tool name a source item names, with the field it sits in. */
function itemTools(item: SourceItem): { readonly name: string; readonly where: string }[] {
  const found: { name: string; where: string }[] = [{ name: item.tool, where: "tool" }]
  const details: readonly Detail[] = item.kind === "events" ? (item.details ?? []) : []
  for (const [i, detail] of details.entries()) found.push({ name: detail.tool, where: `details[${i}].tool` })
  if (item.scope?.suggest !== undefined) found.push({ name: item.scope.suggest.tool, where: "scope.suggest.tool" })
  return found
}

/** True when a value has every field the rules read; the validator has already reported anything missing. */
function isSourceItem(value: unknown): value is SourceItem {
  if (!plain(value)) return false
  const kind = value["kind"]
  if (kind !== "events" && kind !== "snapshot") return false
  if (typeof value["id"] !== "string" || typeof value["tool"] !== "string") return false
  const permission = value["permission"]
  if (!plain(permission) || !Array.isArray(permission["operations"])) return false
  if (!permission["operations"].every((operation) => typeof operation === "string")) return false
  const action = kind === "events" ? permission["events"] : permission["tool"]
  if (typeof action !== "string") return false
  const details = value["details"]
  if (details !== undefined && !Array.isArray(details)) return false
  if (Array.isArray(details) && !details.every(isDetail)) return false
  const scope = value["scope"]
  if (scope !== undefined) {
    if (!plain(scope) || !Array.isArray(scope["keys"]) || !scope["keys"].every((key) => typeof key === "string")) return false
    if (typeof scope["describe"] !== "string") return false
    const suggest = scope["suggest"]
    if (suggest !== undefined) {
      if (!plain(suggest) || typeof suggest["tool"] !== "string" || !Array.isArray(suggest["operations"])) return false
      if (!suggest["operations"].every((operation) => typeof operation === "string")) return false
    }
  }
  const hosts = value["urlHosts"]
  if (hosts !== undefined && (!Array.isArray(hosts) || !hosts.every((host) => typeof host === "string"))) return false
  return true
}

/** True when a value is a detail with the fields the rules read. */
function isDetail(value: unknown): value is Detail {
  return plain(value) && typeof value["id"] === "string" && typeof value["tool"] === "string" && Array.isArray(value["from"])
}
