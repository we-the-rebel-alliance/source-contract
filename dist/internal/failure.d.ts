/**
 * A read's failure, in the family's form: `CODE: what happened. Next step: …`.
 *
 * TODO(the family's events PR, app#2346 comment 6853236031): the error table with §2.1's additions lands in the
 * family's module; `read` then takes its codes and next steps from there, and this file goes.
 */
/** The codes a read answers (design §2.1). `AUTH_REQUIRED` is read as `NEEDS_SIGN_IN`. */
export declare const FAILURE_CODES: readonly ["NEEDS_SIGN_IN", "ACCOUNT_MISMATCH", "CURSOR_INVALID", "CURSOR_EXPIRED", "RATE_LIMITED", "TOO_LARGE", "SCHEMA_VIOLATION", "PERMISSION_DENIED", "UNAVAILABLE", "SCOPE_MISSING", "BUDGET_EXCEEDED", "SOURCE_DISABLED"];
export type FailureCode = (typeof FAILURE_CODES)[number];
/** A read that did not happen, or whose answer was refused. */
export interface ReadFailure {
    readonly code: FailureCode;
    /** `CODE: what happened. Next step: …`. */
    readonly message: string;
    readonly next: string;
    /** With RATE_LIMITED: when to try again. */
    readonly retryAfterSec?: number;
}
export declare function failure(code: FailureCode, what: string, next: string, retryAfterSec?: number): ReadFailure;
/**
 * A plugin's or a host's error as a read failure: its `code` (or the code its message starts with) when the contract
 * knows it, with `AUTH_REQUIRED` read as `NEEDS_SIGN_IN`; anything else is UNAVAILABLE, with the message's first line.
 */
export declare function failureFromError(error: unknown): ReadFailure;
