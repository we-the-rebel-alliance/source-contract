/**
 * The §2.2 `sources` descriptor, written in zod. zod stays inside the package: `src/schema.ts` exports the validator,
 * never this schema.
 *
 * The shapes and the cross-field rules are both here, so the generated JSON Schema (`dist/schemas/sources.json`)
 * expresses them too: an events item is one branch of the union and carries `reads` and `permission.events` and no
 * `output`, a snapshot is the other, and `cost` is a union of free, metered and billed. What zod cannot put into JSON
 * Schema at all (the tokenised verb rule, the namespace of an action, the public-suffix rule for `urlHosts`, unique ids
 * and keys, a suggest operation that also sits in the running grant) is a conformance check, in
 * `internal/conformance/rules.ts`.
 */
import * as z from "zod"
import { MAX_BYTES_DEFAULT, MAX_BYTES_LIMIT } from "./types.ts"

/** A source id: at least two dotted lowercase segments. */
const SOURCE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/
/** A tool name: lowercase words joined by underscores. */
const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/
/** A permission action: dotted (`gws.events_list`), or a namespaced tool (`slack_events_list`). */
const ACTION = /^(?:[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*|[a-z][a-z0-9]*_[a-z][a-z0-9_]*)$/
/** A provider operation: a dotted API operation, or a bare MCP tool name. */
const OPERATION = /^[A-Za-z][A-Za-z0-9._-]{0,199}$/
/** A scope key: a lowercase word. */
const SCOPE_KEY = /^[a-z][a-z0-9_]{0,31}$/
/** A core name: a lowercase word. */
const CORE_NAME = /^[a-z][a-z0-9-]{0,31}$/
/** An extension name: `x-<namespace>/<name>`, both lowercase words. */
const EXTENSION_NAME = /^x-[a-z][a-z0-9-]{0,31}\/[a-z][a-z0-9-]{0,31}$/
/** A core name or an extension name. */
const NAME_OR_EXTENSION = /^(?:[a-z][a-z0-9-]{0,31}|x-[a-z][a-z0-9-]{0,31}\/[a-z][a-z0-9-]{0,31})$/
/** What a source reads: a core name, or an extension name. */
const READS = NAME_OR_EXTENSION
/** A price unit's name: a lowercase word. */
const PRICE_PER = /^[a-z][a-z0-9-]{0,31}$/
/** An exact host, or `*.` and a registrable domain. */
const HOST = /^(?:\*\.)?[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

const price = z
  .object({
    per: z.string().max(32).regex(PRICE_PER, { error: "must be a lowercase word such as post, author or call" }),
    usd: z.number().min(0),
  })
  .strict()
  .describe("One price unit, in US dollars, from the plugin's own price table.")

const units = z.array(price).min(1)

const freeCost = z
  .object({
    class: z.literal("free"),
    units: z.never({ error: "a free source states no price units" }).optional(),
    probe: z.never({ error: "a free source states no probe cost" }).optional(),
  })
  .strict()

const meteredCost = z
  .object({ class: z.literal("metered"), units, probe: price.optional() })
  .strict()

const billedCost = z
  .object({ class: z.literal("billed"), units, probe: price })
  .strict()

const cost = z
  .discriminatedUnion("class", [freeCost, meteredCost, billedCost], { error: "must be free, metered or billed" })
  .describe("What one read costs, including a probe call, which reads no content.")

const accounts = z
  .object({ named: z.boolean().describe("True when the source reads more than one account, so a read names one.") })
  .strict()
  .describe("Which signed-in accounts a source reads.")

const scope = z
  .object({
    keys: z
      .array(z.string().max(32).regex(SCOPE_KEY, { error: "must be a lowercase scope key such as channels" }))
      .describe("The scope keys a person confirms: labels, channels, repositories. Empty when there is nothing to choose."),
    describe: z.string().max(200).describe("The sentence shown at consent, such as Which labels."),
    suggest: z
      .object({
        tool: z.string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
        operations: z.array(z.string().max(200).regex(OPERATION, { error: "must be a provider operation or an MCP tool name" })).min(1),
      })
      .strict()
      .optional()
      .describe(
        "The read-only tool that lists the values a person may pick, and the operations it asserts. It runs only at bind, in the probe session; its results are shown and never stored, so its operations never enter a running grant.",
      ),
  })
  .strict()
  .describe("What a person confirms at consent, and the sentence that asks them.")

const detail = z
  .object({
    id: z.string().max(64).regex(SOURCE_ID, { error: "must be a dotted id such as gws.gmail.message" }),
    tool: z.string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
    from: z
      .array(z.enum(["external_id", "kind", "occurred_at", "url", "thread", "actors", "labels", "hash"]))
      .min(1)
      .describe("The event fields the detail's input comes from. Identifiers only: an event's title and text are never an input."),
  })
  .strict()
  .describe("One read of an event's detail: the tool, and the event fields its input comes from.")

const permissionBase = {
  operations: z
    .array(z.string().max(200).regex(OPERATION, { error: "must be a provider operation or an MCP tool name" }))
    .min(1)
    .describe("Every operation the source's reads assert, and nothing else."),
}

const permissionEvents = z
  .object({
    events: z.string().max(80).regex(ACTION, { error: "must be a dotted action such as gws.events_list, or a namespaced tool action such as slack_events_list" }),
    tool: z.never({ error: "an events source has events, not tool" }).optional(),
    ...permissionBase,
  })
  .strict()
  .describe("The events_list action, and the provider operations the source asserts.")

const permissionTool = z
  .object({
    tool: z.string().max(80).regex(ACTION, { error: "must be a dotted action such as gws.calendar_today, or a namespaced tool action" }),
    events: z.never({ error: "a snapshot has tool, not events" }).optional(),
    ...permissionBase,
  })
  .strict()
  .describe("The read tool's action, and the provider operations the source asserts.")

const cadence = z
  .object({ providerMinMinutes: z.int().min(1).max(10080).optional() })
  .strict()
  .describe("A provider's own floor between reads. Only where the provider imposes one.")

const urlHosts = z
  .array(
    z
      .string()
      .max(253)
      .regex(HOST, { error: "must be a host such as slack.com, or *.slack.com" }),
  )
  .describe("The hosts an event's url may point at, for display. A consumer renders a url only when its host matches.")

const common = {
  id: z.string().max(64).regex(SOURCE_ID, { error: "must be a dotted source id such as gws.gmail" }),
  tool: z.string().max(64).regex(TOOL_NAME, { error: "must be a tool name" }),
  input: z.looseObject({}).optional().describe("The input the tool needs to reach this source. It carries no account and no secret."),
  accounts: accounts.optional(),
  scope: scope.optional(),
  private: z.boolean().optional().describe("True when everything this source reads is personal: shown at consent."),
  cost,
  cadence: cadence.optional(),
  maxBytes: z
    .int()
    .min(1)
    .max(MAX_BYTES_LIMIT)
    .optional()
    .meta({ default: MAX_BYTES_DEFAULT })
    .describe("The most bytes one result may take: default 65536 (64 KB), at most 1048576 (1 MB)."),
  retentionDays: z.int().min(1).optional().describe("How many days an events consumer keeps what it read."),
  urlHosts: urlHosts.optional(),
}

const events = z
  .object({
    ...common,
    kind: z.literal("events"),
    reads: z
      .string()
      .max(64)
      .regex(READS, { error: "must be a core kind such as message, or x-<namespace>/<name>" })
      .describe("The thing it reads: a core kind, or x-<namespace>/<name>."),
    details: z.array(detail).optional(),
    permission: permissionEvents,
    output: z.never({ error: "an events source has no output: output belongs to a snapshot" }).optional(),
    maxAgeSec: z.never({ error: "an events source has no maxAgeSec: a snapshot may be reused, an events page is read once" }).optional(),
    params: z.never({ error: "an events source has no params: events_list takes since, cursor and limit" }).optional(),
  })
  .strict()
  .describe("An events source: append-only, ordered, read with a cursor.")

const snapshot = z
  .object({
    ...common,
    kind: z.literal("snapshot"),
    output: z
      .string()
      .max(64)
      .regex(NAME_OR_EXTENSION, { error: "must be a registry name such as agenda, or x-<namespace>/<name>" })
      .describe("A registry name, or x-<namespace>/<name>; an x- output carries its schema inline."),
    outputSchema: z
      .union([z.boolean(), z.looseObject({})])
      .optional()
      .describe("An x- output's schema, inline: JSON Schema draft 2020-12. Required for x-, absent for a registry name."),
    params: z.looseObject({}).optional().describe("The parameters a consumer may pass, resolved by the library at read time."),
    permission: permissionTool,
    maxAgeSec: z.int().min(1).optional().describe("How long a result may be reused before it is read again."),
    reads: z.never({ error: "a snapshot has no reads: it is state, not a feed" }).optional(),
    details: z.never({ error: "a snapshot has no details: it has no events to read one of" }).optional(),
  })
  .strict()
  .describe("A snapshot source: the latest state, read on demand.")
  .superRefine((value, ctx) => {
    const extension = EXTENSION_NAME.test(value.output)
    if (extension && value.outputSchema === undefined) {
      ctx.addIssue({ code: "custom", path: ["outputSchema"], message: "an x- output has no registry schema, so the item carries its outputSchema inline" })
    }
    if (!extension && value.outputSchema !== undefined) {
      ctx.addIssue({ code: "custom", path: ["outputSchema"], message: "a registry output names its schema, so outputSchema belongs only to an x- output" })
    }
  })

const source = z.discriminatedUnion("kind", [events, snapshot])

/** The `sources` key of a plugin's package.json, contract version 1. */
export const sourcesSchema = z
  .object({
    contractVersion: z.literal(1),
    items: z.array(source).min(1).describe("The plugin's sources. A source id is unique across the declaration."),
  })
  .strict()
