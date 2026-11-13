/**
 * The page result of `events_list`, contract version 1 (§2.1). The kit validates what a source answers; it does not
 * define a type for it, because the page is the `events` module's.
 *
 * A page carries the envelope (`source`, `plugin`, `account`, `owner`, `asOf`, `trust`), `events`, `cursor` and `more`,
 * then `refused[]` (final drops a consumer may advance past), `failed[]` (retryable drops, which hold the cursor back),
 * `gap` when history was lost, and `cost` for a billed source.
 *
 * `pageChecks` returns the problems by concern, so the kit can name each one; `pageProblems` is their sum.
 */
import type { SourceItem } from "../schema/types.js";
/** What a page is checked against. */
export interface PageOptions {
    readonly source: SourceItem;
    /** The plugin's package name, which every result names. */
    readonly plugin: string;
    /** The input the call was made with, so `failed[]` can be held against the cursor it must not advance. */
    readonly input: Readonly<Record<string, unknown>>;
}
/** The page's problems, by concern. */
export interface PageChecks {
    /** The envelope, the events and their fields. */
    readonly shape: readonly string[];
    /** `failed[]` holds the cursor back, and an empty page still carries one. */
    readonly cursor: readonly string[];
    /** `gap` is shaped, and its window runs forwards. */
    readonly gap: readonly string[];
    /** A refused id is never also an event: a refusal is final. */
    readonly refused: readonly string[];
    /** `cost` is reported by a billed source. */
    readonly cost: readonly string[];
}
/** An ISO date-time with an offset, as §2.1 requires of `occurred_at` and `asOf`. */
export declare const instant: (value: unknown) => value is string;
/**
 * The page's problems, by concern.
 *
 * The Memory additions this enforces: `failed[]` holds the cursor back (a page with a retryable drop answers the cursor
 * it was called with, never a later one), and `refused[]` is final (a refused id is not also an event).
 */
export declare function pageChecks(answer: unknown, options: PageOptions): PageChecks;
/** Every problem with a page, one sentence each. An empty list means the page keeps the contract. */
export declare function pageProblems(answer: unknown, options: PageOptions): string[];
