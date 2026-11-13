/**
 * The conformance kit: one report per source, from a declaration and the plugin's own answers.
 *
 * The kit runs the plugin's reads itself, through a recording permission whose rules are the grants the declaration
 * derives. So a read that asserts more than the declaration holds is refused where the host would refuse it, and a
 * grant no read asserts is reported at the end: declared equals asserted.
 *
 * The kit takes page results, cursors and permission contexts as inputs. It defines no page, cursor or permission of
 * its own: those are the `events`, `cursor` and `permission` modules' work.
 *
 * The calls it makes, which a plugin's test adapts to its own tools:
 *
 *   list({ ...input }, context)                 → the page result of events_list
 *   probe({ source, account? }, context)        → { account, owner, scopes? }
 *   details[id]({ account, scope, fields })     → the page result of one detail read
 *   suggest({ source, account }, context)       → { options: [{ id, label? }] }
 *
 * `context.permission.assert` is the session's permission: a read asserts the actions and operations it uses.
 */
import type { SourceItem } from "../schema/types.js";
import { type ToolDeclaration } from "./rules.js";
import { type Grant, type SessionContext } from "./permission.js";
import { type DetailCallInput } from "./details.js";
/** A case the source refuses, with the code or words its error carries. */
export interface Refusal {
    readonly refuses: string;
}
/** What a case expects: a page, an empty page, an expired cursor, or a refusal. */
export type CaseExpectation = "page" | "empty" | "expired" | Refusal;
/** One `events_list` call and what it must answer. */
export interface PageCase {
    /** The case's name, as a person reads it. */
    readonly name: string;
    /** The call's input. */
    readonly input: Readonly<Record<string, unknown>>;
    /** What the answer must be. `page` when absent. */
    readonly expect?: CaseExpectation | undefined;
}
/** One detail read and the scope it is pinned to. */
export interface DetailCase {
    /** The detail's id, as the source declares it. */
    readonly id: string;
    /** The confirmed scope the read is pinned to: a person's channels, calendars, labels. */
    readonly scope?: Readonly<Record<string, readonly string[]>> | undefined;
    /** The event's values for the fields the detail names. Default: the kit's synthetic event. */
    readonly event?: Readonly<Record<string, unknown>> | undefined;
}
/** The plugin's reads, as the kit calls them. */
export interface ConformanceCalls {
    readonly list?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined;
    readonly probe: (input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>;
    readonly details?: Readonly<Record<string, (input: DetailCallInput, context: SessionContext) => Promise<unknown>>> | undefined;
    readonly suggest?: ((input: Readonly<Record<string, unknown>>, context: SessionContext) => Promise<unknown>) | undefined;
}
/** What `sourceConformance` checks. */
export interface SourceConformanceOptions {
    /** The plugin's package name, which every result names. */
    readonly plugin: string;
    /** The source item, as the schema parsed it. */
    readonly source: SourceItem;
    /** The plugin's declared tools, so every tool the source names can be checked. */
    readonly tools: readonly ToolDeclaration[];
    /** The plugin's reads. */
    readonly calls: ConformanceCalls;
    /** The `events_list` calls and their expected answers. */
    readonly cases?: readonly PageCase[] | undefined;
    /** The detail reads to run. Default: every detail the source declares. */
    readonly detailCases?: readonly DetailCase[] | undefined;
    /** The account the kit hands a read; a display value, never a grant. */
    readonly account?: string | undefined;
    /** The grants to run under. Default: `grantsFor(source)`. */
    readonly grants?: readonly Grant[] | undefined;
}
/** One named check: whether it ran, and what it found. */
export interface ConformanceCheck {
    readonly name: string;
    readonly ran: boolean;
    readonly problems: readonly string[];
}
/** A source's report. `ok` is true when every check that ran passed. */
export interface ConformanceReport {
    readonly source: string;
    readonly plugin: string;
    readonly checks: readonly ConformanceCheck[];
    readonly problems: readonly string[];
    readonly ok: boolean;
}
/**
 * Run every conformance check for one source.
 *
 * The checks, in order: `declaration`, `page-result`, `failed-holds-cursor`, `gap-and-cursor-expired`,
 * `refused-is-final`, `billed-cost`, `probe`, `details`, `suggest`, `unused-grants`.
 */
export declare function sourceConformance(options: SourceConformanceOptions): Promise<ConformanceReport>;
/** `sourceConformance`, for a test or a check: throws one error naming every problem. */
export declare function assertConformance(report: ConformanceReport): void;
