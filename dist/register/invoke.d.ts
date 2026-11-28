import { type AccountProfile } from "../accounts.js";
import { type AccessRegistration, type AgentLike } from "../access/agents.js";
import type { Bus } from "../bus.js";
import { type Manifest } from "../manifest.js";
import { type PlanReservation, type PlanStore } from "./plans.js";
import { type Door, type HandlerTable, type MethodCall, type MethodEntry } from "./handlers.js";
import type { RegisterTelemetry } from "./telemetry.js";
/** The environment one call runs in, resolved once by `register`. */
export interface CallEnvironment {
    readonly name: string;
    readonly manifest: Manifest;
    /** The manifest's hash, as a grant stores it. */
    readonly hash: string;
    readonly entries: readonly MethodEntry[];
    readonly accounts: readonly AccountProfile[];
    /** The plans this plugin instance made: a commit runs as the account its plan recorded. */
    readonly plans: PlanStore;
    /** The rules `register` generated into every agent, and what status reads them from. */
    readonly access: AccessRegistration;
    /** The host's agents as they are when the call asks, so status reads no state kept at setup. */
    readonly agents: () => Promise<readonly AgentLike[]>;
    /** The one recorder every door writes its call's event through. */
    readonly telemetry: RegisterTelemetry;
}
/**
 * The one bus writer, read when a handler runs. `register` creates it from its single RPC registration, which exists
 * only after the doors are wired, so the doors hold this reader rather than a mutable placeholder; no call can run
 * before `setup` returns.
 */
export type BusReader = () => Bus;
/** The handler table and account set, validated once at setup. */
export declare function prepare(manifest: Manifest, handlers: HandlerTable, accounts: readonly AccountProfile[], access: AccessRegistration, agents: () => Promise<readonly AgentLike[]>, telemetry: RegisterTelemetry): CallEnvironment;
/** A call's input and the account it resolves to, before any handler runs. */
export interface PreparedCall {
    readonly input: Record<string, unknown>;
    readonly account: string;
    /** A commit's reservation, released on a refusal before the handler or consumed as it starts. */
    readonly reservation?: PlanReservation;
    /** A commit's plan: the plan handler's full answer, which the commit handler receives as `call.plan`. */
    readonly plan?: unknown;
}
/**
 * The input checked and the account resolved, or a contract refusal. A commit takes no account: its account is the one
 * a verified grant names, or the plugin's only account, or `default` for the handler to read from the plan.
 */
export declare function prepareCall(entry: MethodEntry, raw: unknown, accounts: readonly AccountProfile[], plans: PlanStore): PreparedCall;
/** The answer, checked; a plan must name the method that commits it, and must not mint its own id. */
export declare function checkedOutput(entry: MethodEntry, value: unknown): unknown;
/** Run a prepared call's handler, checking its answer and mapping its failure. */
export declare function execute(environment: CallEnvironment, entry: MethodEntry, prepared: PreparedCall, call: Omit<MethodCall, "account" | "plan" | "bus" | "unguardedAgents">, bus: BusReader): Promise<unknown>;
/** The door's call context from an OpenCode tool context. */
export declare function toolCall(context: {
    readonly sessionID: string;
    readonly agent: string;
    readonly messageID: string;
    readonly id: string;
    readonly signal: AbortSignal;
    readonly progress: (update: Readonly<Record<string, unknown>>) => Promise<void>;
}, door: Exclude<Door, "rpc">): Omit<MethodCall, "account" | "plan" | "bus" | "unguardedAgents">;
