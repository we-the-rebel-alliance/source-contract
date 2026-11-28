import type { Manifest } from "../manifest.js";
import type { Door, MethodEntry } from "./handlers.js";
/**
 * How a call was allowed. `grant` is a host-signed action grant, `ask` is a permission ask that was answered, `rule` is
 * an access rule that needed no ask, and `none` is a call that no confirmation allowed (it was refused).
 */
export type AllowedBy = "grant" | "ask" | "rule" | "none";
/** The host's telemetry wiring: the log path, and the source's version and deployment when the host knows them. */
export interface TelemetryWiring {
    /** The JSON Lines log. Default: the plugin's data directory under the host's data root. */
    readonly path?: string | undefined;
    /** The component version in the event's source. Default: `unknown`. */
    readonly version?: string | undefined;
    /** The deployment in the event's source. Default: `local`. */
    readonly deployment?: string | undefined;
}
/** What one call knows while it runs; its account and confirmation are filled once the register resolves them. */
export interface CallTrace {
    sessionID: string;
    agent: string;
    account: string;
    consumer: string;
    allowedBy: AllowedBy;
}
/** One finished call, as the recorder takes it. */
export interface CallEvent {
    readonly entry: MethodEntry;
    readonly door: Door;
    readonly trace: CallTrace;
    /** `ok`, or the contract code that refused the call. */
    readonly outcome: string;
    readonly durationMs: number;
    /** The call's answer, read for a read's count and cost and never written itself. */
    readonly value?: unknown;
}
/** The recorder one registration holds. */
export interface RegisterTelemetry {
    record(event: CallEvent): void;
}
/**
 * The log a plugin writes when the host gives no path: under the host's data root, in the plugin's own directory.
 * `XDG_DATA_HOME` is respected, as OpenCode respects it; otherwise the root is `~/.local/share`.
 */
export declare function defaultEventLogPath(name: string): string;
/**
 * Build the recorder for one registration. It creates the log once; a path it cannot use leaves telemetry off, and no
 * call fails because of it.
 */
export declare function createRegisterTelemetry(manifest: Manifest, wiring: TelemetryWiring | undefined): RegisterTelemetry;
