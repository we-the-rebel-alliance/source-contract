/**
 * The rules a JSON Schema cannot express, carried from Memory's connector kit into contract version 1.
 *
 * Everything here is a conformance check, not a schema: the read-verb allowlist, the verb and joiner lists, the
 * namespace an action must be in, the `urlHosts` suffix rules, and the uniqueness a JSON Schema cannot state. The
 * generated JSON Schema (`dist/schemas/sources.json`) carries every shape it can; each rule here says why it cannot.
 */
import { SOURCES_SCHEMA } from "../../schema.ts"
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

/** The verbs a read's name, and a provider operation, may carry. `fetch` is not one: it can send data out. */
export const READ_VERBS: readonly string[] = ["read", "get", "list", "search", "lookup", "view", "describe", "history", "query", "count", "status"]

/**
 * Verbs that change something or send something out. A read's name, and an operation, may contain none.
 *
 * One string split at load, so the list is one line of data: a bundled array of quoted words would put "import" beside a
 * quote, and `npm run check:dist` reads that as an import statement.
 */
const WRITE_VERB_WORDS = `send create update delete write post remove add set schedule upload download archive unarchive move merge close reopen approve reject share invite react draft complete run exec execute edit patch put push commit comment reply message broadcast follow block mute pin unpin star assign label lock trash forward dispatch clear flush reset truncate overwrite apply join leave ban toggle kick unban export grant revoke transfer promote demote rename duplicate restore purge wipe drop attach detach notify escalate resolve decline cancel submit vote snooze dismiss acknowledge ack enable disable connect disconnect login logout signin signout mint issue verify hide unhide publish unpublish ingest index reindex sync import save like unlike generate mark bookmark copy print convert`

export const WRITE_VERBS: readonly string[] = WRITE_VERB_WORDS.split(" ")

/** Tokens that join two actions in one name (`get_and_save`): a name is one action, so these are refused. */
export const JOINERS: readonly string[] = ["and", "then", "or"]

/** The event kinds of contract version 1 (§2.1). A plugin adds `x-<plugin>/<kind>`. */
export const CORE_KINDS: readonly string[] = ["message", "meeting", "session", "bookmark", "issue", "pr", "commit", "doc", "event", "task", "file"]

/** Every field of a contract-1 event. */
export const EVENT_FIELDS: readonly string[] = ["external_id", "kind", "occurred_at", "title", "text", "url", "thread", "actors", "labels", "hash"]

/** The event fields a `details` entry may take its input from: identifiers, never an event's own prose. */
export const DETAIL_FIELDS: readonly string[] = ["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"]

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const words = (name: unknown): string[] => String(name ?? "").toLowerCase().split(/[._-]+/).filter(Boolean)
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

/**
 * Why a name is not a read's, or undefined when it is one: it carries no write verb anywhere and names one action.
 *
 * §2.2's rule is that a write verb in a name is refused, and that a compound name is refused; a name such as
 * `calendar_today` is a read's name without being a verb, so this check does not require one.
 */
export function nameProblem(name: unknown): string | undefined {
  if (typeof name !== "string" || name.length === 0) return "a read must be named"
  const parts = words(name)
  const joiner = parts.find((word) => JOINERS.includes(word))
  if (joiner !== undefined) return `"${name}" joins two actions with "${joiner}": name the one action it is`
  const writes = parts.filter((word) => WRITE_VERBS.includes(word))
  if (writes.length > 0) return `"${name}" contains the write verb ${writes.join(", ")}`
  return undefined
}

/** `nameProblem`, and the name must also carry a read verb. Memory's stricter form, for a read a consumer names. */
export function readVerbProblem(name: unknown): string | undefined {
  const problem = nameProblem(name)
  if (problem !== undefined) return problem
  if (!words(name).some((word) => READ_VERBS.includes(word))) return `"${String(name)}" has no read verb (${READ_VERBS.join(", ")})`
  return undefined
}

/**
 * Why an operation is not a read's, or undefined when it is one.
 *
 * A dotted operation (`gmail.users.messages.get`) is a provider call, and its last segment's verb is the allowlist, so
 * `insert`, `batchModify`, `watch` and `untrash` are refused without being listed. A bare operation
 * (`slack_read_channel`) is an MCP tool name, and one of its words is the read verb. Either way, a write verb anywhere
 * is refused first.
 */
export function operationProblem(operation: unknown): string | undefined {
  if (typeof operation !== "string" || operation.length === 0) return "an operation must be named"
  const parts = words(operation)
  const writes = parts.filter((word) => WRITE_VERBS.includes(word))
  if (writes.length > 0) return `"${operation}" contains the write verb ${writes.join(", ")}`
  if (operation.includes(".")) {
    const last = operation.split(".").pop() ?? ""
    const head = words(last)[0] ?? ""
    if (!READ_VERBS.some((read) => head.startsWith(read) || last.startsWith(read))) {
      return `"${operation}" operates "${last}", which does not start with a read verb (${READ_VERBS.join(", ")}): a read never sends, changes or watches`
    }
    return undefined
  }
  if (!parts.some((word) => READ_VERBS.some((read) => word === read || word.startsWith(read)))) {
    return `"${operation}" has no read verb (${READ_VERBS.join(", ")}): a read never sends, changes or watches`
  }
  return undefined
}

/** The multi-label public suffixes a person can register under but not be. */
const PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "go.jp", "co.kr", "or.kr", "co.in", "net.in", "org.in", "co.za",
  "com.br", "net.br", "org.br", "com.mx", "com.ar", "com.co", "com.pe", "com.ve", "com.uy",
  "com.tr", "com.cn", "com.tw", "com.hk", "com.sg", "com.my", "com.ph", "com.vn", "com.pk",
  "com.ng", "com.sa", "com.eg", "com.ua", "com.pl", "com.es", "com.gr", "com.pt", "com.ro",
  "co.id", "co.il", "co.ke", "co.th", "co.ae", "co.ma", "co.bw", "co.zw", "co.tz", "co.ug",
])

/** The hosts anyone can claim. */
const SHARED_HOSTS = new Set([
  "cloudfront.net", "amazonaws.com", "storage.googleapis.com", "blob.core.windows.net", "web.core.windows.net",
  "herokuapp.com", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "github.io", "githubusercontent.com",
  "gitlab.io", "bitbucket.io", "appspot.com", "firebaseapp.com", "web.app", "azurewebsites.net", "elasticbeanstalk.com",
  "onrender.com", "railway.app", "fly.dev", "deno.dev", "glitch.me", "repl.co", "surge.sh", "ngrok.io", "r2.dev",
  "blogspot.com", "wordpress.com", "wixsite.com", "translate.goog", "ipfs.io", "dweb.link", "bit.ly", "tinyurl.com",
])

/** The measurement and advertising hosts a collected link never points at. */
const TRACKER_HOSTS = new Set([
  "doubleclick.net", "google-analytics.com", "googletagmanager.com", "googleadservices.com", "googlesyndication.com",
  "2mdn.net", "facebook.net", "scorecardresearch.com", "criteo.com", "taboola.com", "outbrain.com", "adnxs.com",
  "hotjar.com", "segment.io", "mixpanel.com", "amplitude.com", "quantserve.com", "moatads.com", "adsrvr.org",
  "casalemedia.com", "rubiconproject.com", "pubmatic.com", "openx.net", "clarity.ms", "branch.io", "appsflyer.com",
  "adjust.com", "kochava.com", "smartadserver.com", "teads.tv", "yieldmo.com", "bat.bing.com",
])

/** The second-level labels a ccTLD hands out as registry rules (`com.de`, `co.uk`): one plus a two-letter code is no site. */
const EFFECTIVE_SLD = new Set([
  "com", "co", "gov", "org", "net", "ac", "edu", "ne", "or", "go", "nic", "mil", "sch", "ltd", "plc",
  "gen", "web", "biz", "info", "nom", "res", "idv", "gob", "gouv", "gv", "k12", "muni",
])

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
  const labels = bare.split(".")
  if (labels.length < 2) return "names no registrable domain (a host needs at least two labels)"
  if (labels.some((label) => label.startsWith("xn--"))) return "is a punycode host (a label starting xn--), which hides what it is"
  let suffix: string | null = null
  for (const size of [3, 2]) {
    if (labels.length > size && PUBLIC_SUFFIXES.has(labels.slice(-size).join("."))) {
      suffix = labels.slice(-size).join(".")
      break
    }
  }
  if (PUBLIC_SUFFIXES.has(bare)) return `is a public suffix (${bare}), which names no site`
  if (labels.length === 2 && EFFECTIVE_SLD.has(labels[0] ?? "") && /^[a-z]{2}$/.test(labels[1] ?? "")) return `is an effective-TLD rule (${bare}), which names no site`
  if (suffix !== null && bare === suffix) return `is a public suffix (${suffix}), which names no site`
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
      if (scope.suggest !== undefined && tools !== undefined) {
        const declared = toolOf(scope.suggest)
        if (declared === undefined) problems.push(`${at}.scope.suggest names "${scope.suggest}", which the plugin does not declare`)
        else if (declared.readOnly !== true) problems.push(`${at}.scope.suggest names "${scope.suggest}", which is not declared readOnly: true`)
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
  if (item.scope?.suggest !== undefined) found.push({ name: item.scope.suggest, where: "scope.suggest" })
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
    if (scope["suggest"] !== undefined && typeof scope["suggest"] !== "string") return false
  }
  const hosts = value["urlHosts"]
  if (hosts !== undefined && (!Array.isArray(hosts) || !hosts.every((host) => typeof host === "string"))) return false
  return true
}

/** True when a value is a detail with the fields the rules read. */
function isDetail(value: unknown): value is Detail {
  return plain(value) && typeof value["id"] === "string" && typeof value["tool"] === "string" && Array.isArray(value["from"])
}
