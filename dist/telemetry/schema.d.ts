import type { Validator } from "../internal/checked.js";
import { type TelemetryEvent } from "./definition.js";
/** The envelope of every telemetry event, as a `Validator<TelemetryEvent>`. */
export declare const TELEMETRY_EVENT_SCHEMA: Validator<TelemetryEvent>;
