/**
 * One event against one catalogue: the envelope, then the catalogue's exact fields and classes, then the secret screen.
 *
 * `validateEvent` is the gate every event passes before a log writes it and before a test compares it with its
 * catalogue. It refuses an unknown type, a field the catalogue declares but the event leaves out, a field the event
 * carries but the catalogue does not declare (so it has no class), a field whose class differs from the catalogue, a
 * malformed or mismatched trace, and any value the contract's secret screen flags. A refusal names paths and kinds,
 * never a value, so it cannot echo a secret.
 */
import type { Checked } from "../internal/checked.js";
import { type TelemetryCatalogue, type TelemetryEvent } from "./definition.js";
/**
 * Validate one event against one catalogue (the contract's by default).
 *
 * The answer is the parsed event, or every problem, one sentence each. It never throws.
 */
export declare function validateEvent(event: unknown, catalogue?: TelemetryCatalogue): Checked<TelemetryEvent>;
