import type { Manifest } from "../manifest.js";
import { type AccessContext, type AgentLike } from "../access/agents.js";
import { type GrantWiring, type RpcContext } from "./rpc.js";
import { type ToolContext } from "./tools.js";
import type { HandlerTable } from "./handlers.js";
import { type TelemetryWiring } from "./telemetry.js";
import { type Bus } from "../bus.js";
/** The plugin context the register needs: `ctx`, as OpenCode passes it to `setup`, narrowed structurally. */
export interface RegisterContext {
    /** The plugin's options, from `opencode.json(c)`. */
    readonly options?: Readonly<Record<string, unknown>> | undefined;
    readonly agent: AccessContext["agent"] & RpcContext["agent"] & {
        list(): Promise<{
            readonly data: readonly AgentLike[];
        }>;
    };
    readonly tool: ToolContext["tool"];
    readonly session: RpcContext["session"];
    readonly permission: RpcContext["permission"];
    readonly rpc: RpcContext["rpc"];
}
/** What a plugin may wire into the register beyond the host context: the action-grant verifier and the event log. */
export interface RegisterWiring {
    readonly grant?: GrantWiring | undefined;
    /** The local event log and its source; the host's path when it gives one. */
    readonly telemetry?: TelemetryWiring | undefined;
}
/** The live registration: the bus over it, and disposing it removes the tools, the RPC id and the rules. */
export interface Registration {
    readonly name: string;
    /** The typed bus writer, built from the one RPC registration; every handler call reads the same writer as `call.bus`. */
    readonly bus: Bus;
    dispose(): Promise<void>;
}
/**
 * Wire the plugin's methods through doors 1–3 and generate its access rules.
 *
 * The table and the manifest must name the same methods; a declared method without a handler is refused at setup, as
 * is a handler the manifest does not declare. The returned registration always carries the bus writer, built from the
 * one RPC registration, and every handler call carries it as `call.bus`.
 */
export declare function register(context: RegisterContext, manifest: Manifest, handlers: HandlerTable, wiring?: RegisterWiring): Promise<Registration>;
