/**
 * `broker-client`: a consumer uses a host's broker when one is offered, and reads embedded when none is (design §3 and
 * §4.3). Nothing here needs a host: standalone Memory and Artifacts read embedded with `read`.
 *
 * A broker is a thin layer a host builds over the same library. jelly's (Wave 2) adds a persistent cache keyed by the
 * provider identity from `probe` plus `(source, account, scope, params, window)`, per-person budgets and cadence, and
 * an audit line per read with no content. The host holds the grants it drew consent for, and may only narrow them: a
 * cached answer serves a consumer only when that consumer's own grant covers the same source, account and scope, never
 * another person or viewer. It never advances a consumer's cursor and never transforms an answer.
 *
 * **The wire shape** is one request and one answer (`BrokerRequest`, `BrokerAnswer`), so any host can offer a broker
 * through its own channel: jelly sends them as the `broker` kind of `jelly.core.request` (source-contract#8).
 *
 * - `{ offered: false }`: no broker now; the client reads embedded, for this request.
 * - `{ offered: true, ok: true, value }`: `value` is the plugin's answer, untransformed. The client checks it exactly as
 *   an embedded read does (`acceptAnswer`) and applies `pick`, so a broker never needs to be trusted for shape.
 * - `{ offered: true, ok: false, code, message }`: a refusal, read through the error table.
 *
 * **How a broker is offered.** The consumer's own code passes the transport, from a channel it already trusts (for
 * Memory inside jelly, jelly's core plugin). Never find one by asking over RPC: an RPC id has no owner in OpenCode, so
 * another plugin could answer in the broker's name (app#2346, the ask of OpenCode).
 */
import { failureFromError } from "./internal/failure.ts"
import { acceptAnswer, checkReadRequest, read, type ReadHost, type ReadOutcome, type ReadRequest } from "./read.ts"

/** One read, as a consumer asks a host's broker for it. */
export interface BrokerRequest {
  /** The installed package and version the consumer read its descriptor from. */
  readonly package: string
  readonly version: string
  /** The descriptor hash the consumer consented under; a broker whose own copy differs refuses with PERMISSION_DENIED. */
  readonly descriptorHash: string
  /** Who reads, such as `memory`: for the broker's grant check and its audit line. */
  readonly consumer: string
  readonly source: string
  readonly account?: string
  readonly scope?: Readonly<Record<string, readonly string[]>>
  /** An events read. `since` may be relative; the broker resolves it in the person's time zone. */
  readonly cursor?: string
  readonly since?: string
  readonly limit?: number
  /** A snapshot read. Params may be relative or `$me`; the broker resolves them. */
  readonly params?: Readonly<Record<string, unknown>>
  /** A broker may apply it to send less; the client applies it again. */
  readonly pick?: readonly string[]
}

/** A broker's answer. */
export type BrokerAnswer =
  | { readonly offered: false }
  | { readonly offered: true; readonly ok: true; readonly value: unknown; readonly asOf?: string; readonly cached?: boolean }
  | { readonly offered: true; readonly ok: false; readonly code: string; readonly message: string; readonly next?: string; readonly retryAfterSec?: number }

/** How a consumer reaches a host's broker: one call, through a channel it trusts. */
export type BrokerTransport = (request: BrokerRequest, signal?: AbortSignal) => Promise<BrokerAnswer>

/** A read's outcome, and how it was made. */
export type ReaderOutcome = ReadOutcome & {
  /** "broker" when the host's broker answered, "embedded" when the read ran here. */
  readonly via: "broker" | "embedded"
  /** True when the broker served the answer from its cache. */
  readonly cached?: boolean
}

/** A consumer's reader. */
export interface SourceReader {
  read(request: ReadRequest): Promise<ReaderOutcome>
}

/**
 * Codes a host may send before it takes the package's error table, read as the table's. The table's own codes pass
 * through unchanged.
 */
export const BROKER_CODE_ALIASES: Readonly<Record<string, string>> = {
  NOT_GRANTED: "PERMISSION_DENIED",
  UNKNOWN_SOURCE: "UNAVAILABLE",
  INVALID_INPUT: "SCHEMA_VIOLATION",
  PROVIDER_ERROR: "UNAVAILABLE",
}

/** The request a broker receives for a consumer's read: references to the installed package, never its descriptor or the grant. */
export function brokerRequest(request: ReadRequest): BrokerRequest {
  const scope = request.scope ?? request.grant.scope
  return {
    package: request.installed.package,
    version: request.installed.version,
    descriptorHash: request.installed.hash,
    consumer: request.consumer,
    source: request.source,
    account: request.grant.account,
    ...(scope === undefined ? {} : { scope }),
    ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
    ...(request.since === undefined ? {} : { since: request.since }),
    ...(request.limit === undefined ? {} : { limit: request.limit }),
    ...(request.params === undefined ? {} : { params: request.params }),
    ...(request.pick === undefined ? {} : { pick: request.pick }),
  }
}

const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** True when `answer` has a broker answer's shape. */
export function isBrokerAnswer(answer: unknown): answer is BrokerAnswer {
  if (!plain(answer)) return false
  if (answer["offered"] === false) return true
  if (answer["offered"] !== true) return false
  if (answer["ok"] === true) return "value" in answer
  return answer["ok"] === false && typeof answer["code"] === "string" && typeof answer["message"] === "string"
}

/**
 * The reader a consumer uses. With a broker transport, each read goes to the broker first, after the same checks an
 * embedded read makes; it runs embedded when the broker says it is not offered, when the transport fails, or when its
 * answer is not a broker answer. Without one, every read runs embedded over the consumer's own host.
 */
export function sourceReader(options: { readonly host: ReadHost; readonly broker?: BrokerTransport }): SourceReader {
  const { host, broker } = options
  const embedded = async (request: ReadRequest): Promise<ReaderOutcome> => ({ ...(await read(host, request)), via: "embedded" })
  if (!broker) return { read: embedded }
  return {
    async read(request) {
      const checked = checkReadRequest(request)
      if ("ok" in checked) return { ...checked, via: "embedded" }
      let answer: unknown
      try {
        answer = await broker(brokerRequest(request), request.signal)
      } catch {
        return embedded(request)
      }
      if (!isBrokerAnswer(answer) || !answer.offered) return embedded(request)
      if (!answer.ok) {
        const code = BROKER_CODE_ALIASES[answer.code] ?? answer.code
        const failure = failureFromError({
          code,
          message: answer.message,
          data: { ...(answer.next === undefined ? {} : { next: answer.next }), ...(answer.retryAfterSec === undefined ? {} : { retryAfterSec: answer.retryAfterSec }) },
        })
        return { ok: false, failure, via: "broker" }
      }
      const accepted = acceptAnswer(checked.source, request.grant.account, answer.value, {
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        ...(request.pick === undefined ? {} : { pick: request.pick }),
      })
      return { ...accepted, via: "broker", ...(answer.cached === undefined ? {} : { cached: answer.cached }) }
    },
  }
}
