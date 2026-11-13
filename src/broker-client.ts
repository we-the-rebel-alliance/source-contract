/**
 * `broker-client`: a consumer uses a host's broker when one is offered, and reads embedded when none is (design §3 and
 * §4.3). Nothing here needs a host: standalone Memory and Artifacts read embedded with `read`.
 *
 * A broker is a thin layer a host builds over the same library. jelly's (Wave 2) adds a persistent cache keyed by the
 * provider identity from `probe` plus `(source, account, scope, params, window)`, per-person budgets and cadence, and
 * an audit line per read with no content. It may only narrow a grant: a cached answer serves a consumer only when that
 * consumer's own grant covers the same source, account and scope, never another person or viewer. It never advances a
 * consumer's cursor and never transforms an answer.
 *
 * **How a broker is offered.** The host passes it to the consumer through a channel the consumer already trusts, such
 * as jelly's core plugin handing it to Memory inside jelly. Never accept one found by asking over RPC: an RPC id has no
 * owner in OpenCode, so another plugin could answer in the broker's name (app#2346, the ask of OpenCode).
 */
import type { ParamsContext } from "./params.ts"
import type { Grant } from "./permission.ts"
import { read, type ReadHost, type ReadOutcome, type ReadRequest } from "./read.ts"

/** The broker interface version this package speaks. A broker offering another is not used. */
export const BROKER_VERSION = 1

/** One read through a broker: what `read` takes, by reference to the installed package rather than its descriptor. */
export interface BrokerReadRequest {
  /** The installed package and version the consumer read its descriptor from. */
  readonly package: string
  readonly version: string
  /** The descriptor hash the grant was made for; the broker refuses a read when its own copy differs. */
  readonly descriptorHash: string
  readonly source: string
  readonly consumer: string
  readonly grant: Grant
  readonly scope?: Readonly<Record<string, readonly string[]>>
  readonly cursor?: string
  readonly since?: string
  readonly limit?: number
  readonly params?: Readonly<Record<string, unknown>>
  readonly pick?: readonly string[]
  readonly context: ParamsContext
}

/** What a host offers. */
export interface SourceBroker {
  readonly version: number
  /** Reads under the grant, from the shared cache when the grant covers it, or by calling the source. */
  read(request: BrokerReadRequest, signal?: AbortSignal): Promise<ReadOutcome>
}

/** A consumer's reader: a broker when one is offered and usable, `read` embedded otherwise. */
export interface SourceReader {
  /** "broker" when reads go through the host's broker, "embedded" when they run here. */
  readonly mode: "broker" | "embedded"
  read(request: ReadRequest): Promise<ReadOutcome>
}

/** True when `offered` is a broker this package can use: the right version, with a read function. */
export function isUsableBroker(offered: unknown): offered is SourceBroker {
  if (typeof offered !== "object" || offered === null) return false
  const broker = offered as Partial<SourceBroker>
  return broker.version === BROKER_VERSION && typeof broker.read === "function"
}

/**
 * The reader a consumer uses: the offered broker when it is usable, and `read` over the consumer's own host otherwise.
 * An offer of another version is not used, so a consumer never depends on the host it runs in.
 */
export function sourceReader(options: { readonly host: ReadHost; readonly offered?: unknown }): SourceReader {
  const { host, offered } = options
  if (isUsableBroker(offered)) {
    return {
      mode: "broker",
      read: (request) =>
        offered.read(
          {
            package: request.installed.package,
            version: request.installed.version,
            descriptorHash: request.installed.hash,
            source: request.source,
            consumer: request.consumer,
            grant: request.grant,
            context: request.context,
            ...(request.scope === undefined ? {} : { scope: request.scope }),
            ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
            ...(request.since === undefined ? {} : { since: request.since }),
            ...(request.limit === undefined ? {} : { limit: request.limit }),
            ...(request.params === undefined ? {} : { params: request.params }),
            ...(request.pick === undefined ? {} : { pick: request.pick }),
          },
          request.signal,
        ),
    }
  }
  return { mode: "embedded", read: (request) => read(host, request) }
}
