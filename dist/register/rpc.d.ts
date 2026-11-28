import { type AccessLevel } from "../access.js";
import { type GrantKeys, type GrantScope, type GrantStore } from "../grant.js";
import { type BusReader, type CallEnvironment } from "./invoke.js";
/** What the plugin wires into the grant verifier: the host's keys, the audience and the durable ledger. */
export interface GrantWiring {
    /** The public keys the host signs with, by `kid`, and revoked ids. */
    readonly keys: GrantKeys;
    /** The plugin's package name, which the grant's `aud` must name. */
    readonly audience: string;
    /** Where single use is recorded; the plugin backs it with durable storage. */
    readonly store: GrantStore;
    /** The scope the grant must name; `{}` (the whole method) when absent. */
    readonly scope?: GrantScope;
    /** The current time in seconds; the real clock when absent. */
    readonly now?: () => number;
}
/** A context that can answer a refusal, as OpenCode's RPC call context does. */
export interface RpcCallContext {
    readonly signal: AbortSignal;
    error(type: "failed", message: string, data: {
        readonly code: string;
        readonly next: string;
    }): unknown;
}
/** The part of the plugin context the RPC uses. */
export interface RpcContext {
    readonly session: {
        get(input: {
            readonly sessionID: string;
        }): Promise<{
            readonly agent?: string;
            readonly permissions?: readonly {
                readonly action: string;
                readonly resource: string;
                readonly effect: "allow" | "deny" | "ask";
            }[];
        }>;
    };
    readonly agent: {
        get(input: {
            readonly agentID: string;
        }): Promise<{
            readonly data: {
                readonly permissions: readonly {
                    readonly action: string;
                    readonly resource: string;
                    readonly effect: "allow" | "deny" | "ask";
                }[];
            };
        }>;
    };
    readonly permission: {
        assert(input: {
            readonly sessionID: string;
            readonly agent?: string;
            readonly action: string;
            readonly resources: readonly string[];
            readonly save?: readonly string[];
            readonly source?: {
                readonly type: "tool";
                readonly messageID: string;
                readonly id: string;
            };
        }): Promise<void>;
        hook(name: "evaluate", callback: (event: {
            effect: "allow" | "deny" | "ask";
            source?: {
                readonly id: string;
            };
        }) => void | Promise<void>): Promise<{
            dispose(): Promise<void>;
        }>;
        /** The session's pending asks, so a cancelled call can reject its own. */
        list?(input: {
            readonly sessionID: string;
        }): Promise<readonly {
            readonly id: string;
            readonly source?: {
                readonly type: "tool";
                readonly messageID: string;
                readonly id: string;
            } | undefined;
        }[]>;
        /** Answer a pending ask; a cancellation answers `reject`. */
        reply?(input: {
            readonly sessionID: string;
            readonly requestID: string;
            readonly decision: "reject";
            readonly message?: string | undefined;
        }): Promise<void>;
    };
    readonly rpc: {
        register(definition: unknown, handlers: Readonly<Record<string, (input: unknown, context: RpcCallContext) => Promise<unknown>>>): Promise<RpcRegistration>;
    };
}
/** One live registration, as OpenCode returns it: a disposer and the events emitter. */
export interface RpcRegistration {
    readonly events: {
        emit(name: string, data: unknown): Promise<void>;
    };
    dispose(): Promise<void>;
}
/** The part of a context the rule lookup reads: both doors have it, and the gate stays the authority. */
export interface RulesContext {
    readonly session: RpcContext["session"];
    readonly agent: RpcContext["agent"];
}
/** The session's agent and rules: the agent's, then the session's, as OpenCode reads them. */
export declare function rulesOf(context: RulesContext, sessionID: string): Promise<{
    readonly agent: string;
    readonly rules: readonly {
        readonly action: string;
        readonly resource: string;
        readonly effect: "allow" | "deny" | "ask";
    }[];
}>;
/** The RPC definition and handlers, and the one registration that carries the bus events. */
export declare function installRpc(context: RpcContext, environment: CallEnvironment, level: AccessLevel, wiring: GrantWiring | undefined, bus: BusReader): Promise<RpcRegistration>;
