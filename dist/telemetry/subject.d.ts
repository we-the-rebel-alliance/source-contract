/**
 * The envelope's pseudonymous subject and its W3C trace context.
 *
 * A subject is a compact string of the ids that belong to one person, agent, session and trace: `person=…;agent=…`.
 * The ids are pseudonyms, never an account, a token or a raw provider id. The trace id is also carried by the
 * distributed-tracing extension `traceparent`, and the two must name the same trace when both are present.
 */
/** The pseudonymous ids an event may name. A part is left out when the work has no such id. */
export interface TelemetrySubject {
    readonly person?: string;
    readonly agent?: string;
    readonly session?: string;
    readonly trace?: string;
}
/** The parts of a subject, in the order an envelope writes them. */
export declare const SUBJECT_KEYS: readonly ["person", "agent", "session", "trace"];
/** True when `value` is a W3C `traceparent`: a valid version, trace id, span id and flags, without all-zero ids. */
export declare function isTraceparent(value: unknown): value is string;
/** The trace id a `traceparent` names, or undefined when it is not one. */
export declare function traceIdOf(traceparent: string): string | undefined;
/** The envelope's `subject` string, or undefined when no id is present. */
export declare function subjectString(subject: TelemetrySubject | undefined): string | undefined;
/** A parsed subject, or the problems that stop `subject` from being one. */
export type ParsedSubject = {
    readonly ok: true;
    readonly value: TelemetrySubject;
} | {
    readonly ok: false;
    readonly problems: readonly string[];
};
/** Parse the envelope's `subject` string. Duplicate or unknown keys are refused. */
export declare function parseSubject(subject: string | undefined): ParsedSubject;
