/**
 * The descriptor (design §2.2): the top-level `sources` key of a plugin's `package.json`, read from the installed
 * package on disk, never from RPC. It is the trust root: `describe` and anything said over RPC are diagnostics only,
 * because an RPC id has no owner in OpenCode (another plugin can answer it).
 *
 *   const installed = readInstalledDescriptor("/path/to/node_modules/@scope/plugin", { version: "1.2.3" })
 *   if (installed.ok) installed.value.hash   // "sha256:…": a grant stores it; a changed descriptor asks again
 *
 * Validation is Memory's descriptor schema (`schema`, `SOURCES_SCHEMA`) first, then this library's frame, which adds
 * what only the package can check: a snapshot's `output` is a registered schema. The rules a JSON Schema cannot
 * express (verbs, namespaces, `urlHosts`) are the conformance kit's, which a plugin runs in its own CI.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import * as z from "zod"
import { SUPPORTED_CONTRACT_VERSIONS } from "./index.ts"
import type { Checked } from "./internal/checked.ts"
import { EVENT_KINDS, isEventKind, MAX_BYTES } from "./internal/events.ts"
import { problemsOf } from "./internal/validator.ts"
import type { ParamSpec } from "./params.ts"
import { isOutputName, OUTPUT_NAMES } from "./registry.ts"
import { SOURCES_SCHEMA } from "./schema.ts"

/** The most bytes a source may declare for one answer (1 MB), and the default when it declares none (64 KB): `events`' `MAX_BYTES`. */
export const MAX_BYTES_LIMIT: number = MAX_BYTES.max
export const DEFAULT_MAX_BYTES: number = MAX_BYTES.default

/** Who may be asked, and how (design §2.2 `permission`). */
export interface SourcePermission {
  /** An events source's method action, such as `gws.events_list`. */
  readonly events?: string
  /** A snapshot source's method action, such as `gws.calendar_today`. */
  readonly tool?: string
  /**
   * What the read does at the provider: what grants and a person's off switches key on. A dotted operation
   * (`gmail.users.messages.get`) is asserted as `<namespace>.read` on `<account>:<operation>`; a bare one
   * (`slack_read_channel`) is an MCP tool, asserted as `<namespace>_<operation>` on `*` (`permission.operationRule`).
   */
  readonly operations: readonly string[]
  /** The identity operations `probe` asserts for this source, never among `operations` (#4, point 3). Optional. */
  readonly identity?: readonly string[]
}

/** A detail read: a declared read per event, whose inputs come only from the event's own fields, never its text. */
export interface SourceDetail {
  readonly id: string
  readonly tool: string
  /** The event fields its input is: `external_id`, `thread`, and the others Memory's schema lists. */
  readonly from: readonly string[]
}

/** One source a plugin declares. */
export interface SourceItem {
  readonly id: string
  readonly kind: "events" | "snapshot"
  /** The tools-RPC method a read calls. */
  readonly tool: string
  /** Fixed input the method always gets, such as `{ "source": "gmail" }`. */
  readonly input?: Readonly<Record<string, unknown>>
  /** An events source's event kind. */
  readonly reads?: string
  /** A snapshot source's output, a registered schema. */
  readonly output?: string
  readonly params?: Readonly<Record<string, ParamSpec>>
  readonly accounts?: { readonly named?: boolean }
  readonly scope?: {
    readonly keys: readonly string[]
    readonly describe?: string
    /** The read-only tool that lists choices at consent, and the operations it asserts; run only at bind. */
    readonly suggest?: { readonly tool: string; readonly operations: readonly string[] }
  }
  readonly details?: readonly SourceDetail[]
  readonly permission: SourcePermission
  readonly private?: boolean
  readonly cost: {
    readonly class: "free" | "metered" | "billed"
    readonly units?: readonly { readonly per: string; readonly usd: number }[]
    readonly probe?: { readonly per: string; readonly usd: number }
  }
  readonly cadence?: { readonly providerMinMinutes?: number }
  readonly maxBytes?: number
  readonly maxAgeSec?: number
  readonly retentionDays?: number
  readonly urlHosts?: readonly string[]
  readonly [key: string]: unknown
}

/** The `sources` key. */
export interface SourcesDescriptor {
  readonly contractVersion: number
  /** The plugin's tools-RPC id, `<OpenCode plugin id>.tools` (#4). Optional; when declared, `read` calls it. */
  readonly rpc?: string
  /** The plugin's one `probe` tool: the permission action it asserts (#4, #8). Optional. */
  readonly probe?: { readonly action: string }
  readonly items: readonly SourceItem[]
}

/** A descriptor as read from an installed package. */
export interface InstalledDescriptor {
  /** The package's name and version, from the same package.json. */
  readonly package: string
  readonly version: string
  /** The package's directory on disk. */
  readonly directory: string
  readonly sources: SourcesDescriptor
  /** `sha256:` and the hex digest of the canonical JSON of `sources`. */
  readonly hash: string
}

const SOURCE_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const METHOD = /^[A-Za-z0-9_.-]{1,100}$/
const ACTION = /^[A-Za-z0-9_.-]{1,200}$/
const OPERATION = /^[A-Za-z0-9_.-]{1,200}$/
/** The event fields a detail read may take its input from (Memory's schema): identifiers and metadata, never `title` or `text`. */
export const DETAIL_FIELDS = ["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"] as const

const action = z.string().regex(ACTION, "must be a permission action, such as gws.events_list")
const operation = z.string().regex(OPERATION, "must be an operation name of letters, digits, dots, underscores or hyphens")
const price = z.object({ per: z.string().min(1).max(40), usd: z.number().nonnegative().finite() })

const item = z
  .looseObject({
    id: z.string().regex(SOURCE_ID, "must be the plugin's name and the source's, dotted and lowercase, such as gws.gmail"),
    kind: z.enum(["events", "snapshot"]),
    tool: z.string().regex(METHOD, "must be a tools-RPC method name"),
    input: z.record(z.string(), z.unknown()).optional(),
    // PROVISIONAL (app#2346 decisions D13 and D15, PR #7): one event kind, core or x-<plugin>/<kind>. Whether `reads`
    // takes a list, and whether an extension's <plugin> must match the descriptor's, are not agreed yet.
    reads: z.string().refine(isEventKind, `must be an event kind: ${EVENT_KINDS.join(", ")}, or x-<plugin>/<kind>`).optional(),
    output: z.string().optional(),
    params: z.record(z.string(), z.looseObject({ relative: z.boolean().optional(), me: z.boolean().optional() })).optional(),
    accounts: z.looseObject({ named: z.boolean().optional() }).optional(),
    scope: z.looseObject({ keys: z.array(z.string().regex(/^[a-z][a-zA-Z0-9_-]{0,39}$/)).min(1), describe: z.string().max(200).optional() }).optional(),
    details: z
      .array(
        z.looseObject({
          id: z.string().regex(SOURCE_ID),
          tool: z.string().regex(METHOD),
          from: z.array(z.enum(DETAIL_FIELDS)).min(1),
        }),
      )
      .optional(),
    permission: z.looseObject({
      events: action.optional(),
      tool: action.optional(),
      operations: z.array(operation).min(1, "must name at least one operation: grants and off switches key on them"),
    }),
    private: z.boolean().optional(),
    cost: z.looseObject({ class: z.enum(["free", "metered", "billed"]), units: z.array(price).optional(), probe: price.optional() }),
    cadence: z.looseObject({ providerMinMinutes: z.number().int().positive().optional() }).optional(),
    maxBytes: z.number().int().positive().max(MAX_BYTES_LIMIT, `must be at most ${MAX_BYTES_LIMIT} (1 MB)`).optional(),
    maxAgeSec: z.number().int().positive().optional(),
    retentionDays: z.number().int().positive().optional(),
    urlHosts: z.array(z.string().min(1).max(253)).optional(),
  })
  .superRefine((source, context) => {
    const problem = (path: PropertyKey[], message: string) => context.addIssue({ code: "custom", path, message })
    if (source.kind === "events") {
      if (source.reads === undefined) problem(["reads"], "an events source must say which event kind it reads")
      if (source.permission.events === undefined) problem(["permission", "events"], "an events source must name its method's action")
      if (source.output !== undefined) problem(["output"], "only a snapshot source has an output")
    } else {
      if (source.output === undefined) problem(["output"], `a snapshot source must name its output (${OUTPUT_NAMES.join(", ")})`)
      else if (!isOutputName(source.output)) problem(["output"], `"${source.output}" is not a registered output (${OUTPUT_NAMES.join(", ")})`)
      if (source.permission.tool === undefined) problem(["permission", "tool"], "a snapshot source must name its method's action")
      if (source.details !== undefined) problem(["details"], "only an events source has detail reads")
    }
    if (source.permission.events !== undefined && source.permission.tool !== undefined) problem(["permission"], "name one method action: events or tool, not both")
    if (source.cost?.class === "billed" && (source.cost.units === undefined || source.cost.units.length === 0)) {
      problem(["cost", "units"], "a billed source must state its price units")
    }
  })

/** A tools-RPC id: lowercase dotted words, ending in `.tools` (the family's `isToolsRpcId`). */
const TOOLS_RPC_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.tools$/

const sources = z
  .looseObject({
    rpc: z.string().regex(TOOLS_RPC_ID, "must be a tools-RPC id: the plugin id and .tools, such as google-workspace.gws.tools").optional(),
    probe: z.looseObject({ action }).optional(),
    contractVersion: z.number().int().refine((version) => SUPPORTED_CONTRACT_VERSIONS.includes(version), {
      message: `must be a contract version this package reads (${SUPPORTED_CONTRACT_VERSIONS.join(", ")})`,
    }),
    items: z.array(item).min(1, "must declare at least one source"),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>()
    for (const [index, source] of value.items.entries()) {
      for (const id of [source.id, ...(source.details ?? []).map((detail) => detail.id)]) {
        if (seen.has(id)) context.addIssue({ code: "custom", path: ["items", index, "id"], message: `"${id}" is declared twice` })
        seen.add(id)
      }
    }
  })

/** The `sources` value checked against Memory's schema, then the frame; its problems, one sentence each, when it breaks them. */
export function checkSources(value: unknown): Checked<SourcesDescriptor> {
  const schema = SOURCES_SCHEMA.check(value)
  if (!schema.ok) return { ok: false, problems: schema.problems.map((problem) => `sources.${problem}`.replace("sources.the value", "sources")) }
  const result = sources.safeParse(value)
  if (result.success) return { ok: true, value: value as SourcesDescriptor }
  return { ok: false, problems: problemsOf(result.error).map((problem) => `sources.${problem}`.replace("sources.the value", "sources")) }
}

/** Canonical JSON: object keys sorted at every depth, no spaces. Arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** The descriptor's hash: `sha256:` and the hex digest of its canonical JSON. Key order does not change it. */
export function descriptorHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`
}

/**
 * The descriptor of the package installed at `directory`: its package.json's `sources`, checked and hashed. With
 * `version`, the package.json must say that version, so a consumer reads the package it believes is installed.
 */
export function readInstalledDescriptor(directory: string, options: { readonly version?: string } = {}): Checked<InstalledDescriptor> {
  const file = join(directory, "package.json")
  let pkg: unknown
  try {
    pkg = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "there is no package.json there" : "its package.json is not JSON"
    return { ok: false, problems: [`no descriptor at ${directory}: ${reason}`] }
  }
  if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg)) return { ok: false, problems: [`no descriptor at ${directory}: its package.json is not an object`] }
  const { name, version, sources: declared } = pkg as Record<string, unknown>
  if (typeof name !== "string" || typeof version !== "string") return { ok: false, problems: [`no descriptor at ${directory}: its package.json has no name and version`] }
  if (options.version !== undefined && options.version !== version) {
    return { ok: false, problems: [`${name} at ${directory} is version ${version}, not the ${options.version} the install names`] }
  }
  if (declared === undefined) return { ok: false, problems: [`${name} ${version} declares no sources (no top-level "sources" key)`] }
  const checked = checkSources(declared)
  if (!checked.ok) return { ok: false, problems: checked.problems.map((problem) => `${name} ${version}: ${problem}`) }
  return { ok: true, value: { package: name, version, directory, sources: checked.value, hash: descriptorHash(declared) } }
}

/**
 * The directory of the package `name` as Node would find it installed from `from`: the nearest
 * `node_modules/<name>/package.json` at or above it. Undefined when none is installed.
 */
export function findInstalledPackage(name: string, from: string): string | undefined {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) return undefined
  let directory = from
  for (;;) {
    const candidate = join(directory, "node_modules", ...name.split("/"))
    if (existsSync(join(candidate, "package.json"))) return candidate
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

/** A source by id, from a descriptor. */
export function findSource(descriptor: SourcesDescriptor, id: string): SourceItem | undefined {
  return descriptor.items.find((source) => source.id === id)
}

/** The most bytes one answer of this source may take: its `maxBytes`, or 64 KB. */
export function maxBytesOf(source: Pick<SourceItem, "maxBytes">): number {
  return source.maxBytes ?? DEFAULT_MAX_BYTES
}
