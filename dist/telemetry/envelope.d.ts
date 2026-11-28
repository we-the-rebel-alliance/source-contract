import { type TelemetryCatalogue, type TelemetryEvent } from "./definition.js";
import { type TelemetrySubject } from "./subject.js";
/** The component, its version and the deployment, as the envelope's `source` names them. */
export interface TelemetrySource {
    readonly component: string;
    readonly version: string;
    readonly deployment: string;
}
/** What `createEvent` takes. The catalogue's own fields are the last input. */
export interface CreateEventInput {
    readonly type: string;
    /** The event's version in the catalogue. A type with one version may leave it out. */
    readonly version?: number;
    readonly source: TelemetrySource;
    readonly subject?: TelemetrySubject;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly traceparent?: string;
    readonly id?: string;
    readonly time?: string | number | Date;
    /** The catalogue to use; the contract's by default. */
    readonly catalogue?: TelemetryCatalogue;
}
/** Build one event, with each field's class taken from the catalogue, and refuse it when it is not valid. */
export declare function createEvent(input: CreateEventInput): TelemetryEvent;
