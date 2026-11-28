import { type TelemetryCatalogue, type TelemetryEvent } from "./definition.js";
/** Where the log is and which catalogue it accepts. */
export interface EventLogOptions {
    /** The JSON Lines file. Its directory is created when it is missing. */
    readonly path: string;
    /** The catalogue to validate against; the contract's by default. */
    readonly catalogue?: TelemetryCatalogue;
}
/** What an append answers: the event's id, or why it was not written. */
export type EventLogAppendResult = {
    readonly ok: true;
    readonly id: string;
} | {
    readonly ok: false;
    readonly reason: "invalid";
    readonly problems: readonly string[];
} | {
    readonly ok: false;
    readonly reason: "unavailable";
};
/** A log a plugin holds: append one event, or read the complete lines it has written. */
export interface EventLog {
    /** The resolved file path. */
    readonly path: string;
    append(event: unknown): EventLogAppendResult;
    /** Every complete event, oldest first. A torn or unreadable line is skipped. */
    read(): TelemetryEvent[];
}
/** Create the local event log at `path`. A path that is not a string is a programming error and throws here. */
export declare function createEventLog(options: EventLogOptions): EventLog;
