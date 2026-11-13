/**
 * The output schema registry (design §2.4): the shapes a snapshot source's `data` may take, by name.
 *
 * A snapshot source names one in its descriptor (`"output": "agenda"`), and its `snapshot_read` answers `data` valid
 * against it. A project that can render a schema can render every source that outputs it: an `agenda` is an agenda,
 * whichever plugin read it.
 *
 * Seeded from what is in production: jelly's Home template schemas (`protocol/contracts/src/home-data.ts` in
 * we-the-rebel-alliance/app), where `agenda` is gws `calendar.today`'s shape, with `thread`, `table` and `record`.
 * Host-neutral changes from the seed: enums are closed (a producer must send a known value); `image` takes an https
 * `url` or a `dataUri` (jelly's saved-file id is jelly's own), and its `dataUri` is capped so the whole answer fits in
 * the 1 MB a source's `maxBytes` allows, so gws `images.read` fits (app#2346).
 *
 * The registry only grows within a contract version: a name is never removed or narrowed, so a source that validates
 * today still validates under a later minor version.
 */
import * as z from "zod"
import type { Checked, Validator } from "./internal/checked.ts"
import { validator } from "./internal/validator.ts"

const text = (max: number) => z.string().max(max)
const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:"
    } catch {
      return false
    }
  }, "must be an https URL")
const timestamp = z.iso.datetime({ offset: true })
const date = z.union([timestamp, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date-time with an offset, or a date")])
const item = {
  id: z.string().min(1).max(128),
  url: httpsUrl.optional(),
  ask: text(200).optional(),
}

/**
 * The most characters a `dataUri` takes: 1 MB less 4 KB, so the whole answer (the data URI, the other fields and the
 * envelope) fits in the 1 MB that `maxBytes` allows, counted as the answer's JSON bytes (#7, decision 21). That is about
 * 760 KB of image; a source downsizes a larger one, or answers an https `url`.
 */
export const IMAGE_DATA_URI_MAX = 1024 * 1024 - 4 * 1024

const agenda = z
  .object({
    items: z
      .array(
        z
          .object({
            ...item,
            title: text(120),
            start: date,
            end: date.optional(),
            allDay: z.boolean().optional(),
            location: text(120).optional(),
            calendar: text(60).optional(),
            joinUrl: httpsUrl.optional(),
          })
          .strict(),
      )
      .max(50),
    rangeEnd: date.optional(),
  })
  .strict()

const inbox = z
  .object({
    unread: z.number().int().nonnegative().nullable(),
    unit: text(20).optional(),
    label: text(60).optional(),
    items: z
      .array(
        z
          .object({
            ...item,
            title: text(120),
            from: text(60).optional(),
            preview: text(200).optional(),
            at: timestamp,
            count: z.number().int().nonnegative().optional(),
            important: z.boolean().optional(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()

const metric = z
  .object({
    label: text(40),
    value: z.union([z.number().finite(), text(20)]),
    unit: text(10).optional(),
    delta: z
      .object({
        value: z.number().finite(),
        direction: z.enum(["up", "down", "flat"]),
        good: z.boolean().optional(),
      })
      .strict()
      .optional(),
    spark: z.array(z.number().finite()).max(48).optional(),
  })
  .strict()

const list = z
  .object({
    items: z
      .array(
        z
          .object({
            id: item.id,
            text: text(200),
            done: z.boolean().optional(),
            note: text(200).optional(),
            due: date.optional(),
          })
          .strict(),
      )
      .max(50),
    editable: z.boolean(),
  })
  .strict()

const progress = z
  .object({
    label: text(60),
    value: z.number().nonnegative(),
    max: z.number().positive(),
    steps: z
      .array(z.object({ label: text(40), done: z.boolean() }).strict())
      .max(12)
      .optional(),
    eta: timestamp.optional(),
  })
  .strict()
  .refine((value) => value.value <= value.max, { message: "value must not exceed max", path: ["value"] })

const note = z.object({ markdown: text(16 * 1024) }).strict()

const links = z
  .object({
    items: z
      .array(
        z
          .object({
            ...item,
            title: text(60),
            url: httpsUrl,
            hint: text(60).optional(),
          })
          .strict(),
      )
      .max(12),
  })
  .strict()

const countdown = z
  .object({
    label: text(60),
    target: timestamp,
    style: z.enum(["relative", "timer"]),
  })
  .strict()

const image = z
  .object({
    url: httpsUrl.optional(),
    dataUri: z
      .string()
      .max(IMAGE_DATA_URI_MAX)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "must be a base64 data URI of a png, jpeg or webp image")
      .optional(),
    alt: z.string().min(1).max(200),
    caption: text(120).optional(),
  })
  .strict()
  .refine((value) => (value.url === undefined) !== (value.dataUri === undefined), { message: "give exactly one of url and dataUri" })

const thread = z
  .object({
    subject: text(200),
    messages: z
      .array(
        z
          .object({
            ...item,
            from: text(120),
            at: timestamp,
            body: text(4000),
            quoted: text(4000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()

const table = z
  .object({
    columns: z
      .array(z.object({ key: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), label: text(40) }).strict())
      .min(1)
      .max(8),
    rows: z.array(z.record(z.string(), z.union([text(200), z.number().finite(), z.boolean(), z.null()]))).max(100),
  })
  .strict()

const record = z
  .object({
    title: text(120),
    fields: z
      .array(z.object({ label: text(60), value: text(400) }).strict())
      .min(1)
      .max(24),
  })
  .strict()

/** Every registered output, by name. */
export const OUTPUTS = {
  agenda: validator("output.agenda", agenda),
  inbox: validator("output.inbox", inbox),
  metric: validator("output.metric", metric),
  list: validator("output.list", list),
  progress: validator("output.progress", progress),
  note: validator("output.note", note),
  links: validator("output.links", links),
  countdown: validator("output.countdown", countdown),
  image: validator("output.image", image),
  thread: validator("output.thread", thread),
  table: validator("output.table", table),
  record: validator("output.record", record),
}

/** A registered output's name. */
export type OutputName = keyof typeof OUTPUTS

/** The `data` a source with this output answers. */
export type Output<N extends OutputName> = (typeof OUTPUTS)[N] extends Validator<infer T> ? T : never

/** Every registered name, in the order above. */
export const OUTPUT_NAMES = Object.keys(OUTPUTS) as OutputName[]

/** True when `name` is a registered output. */
export function isOutputName(name: unknown): name is OutputName {
  return typeof name === "string" && Object.hasOwn(OUTPUTS, name)
}

/** The validator of a registered output, or undefined for a name the registry does not hold. */
export function outputValidator(name: string): Validator<unknown> | undefined {
  return isOutputName(name) ? OUTPUTS[name] : undefined
}

/** `data` checked against the named output; a name the registry does not hold is a problem, not a throw. */
export function checkOutput(name: string, data: unknown): Checked<unknown> {
  const found = outputValidator(name)
  if (!found) return { ok: false, problems: [`"${name}" is not a registered output (${OUTPUT_NAMES.join(", ")})`] }
  return found.check(data)
}
