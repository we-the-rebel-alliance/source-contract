import type { SourceItem } from "../schema/types.js";
/** What a page is checked against. */
export interface PageOptions {
    readonly source: SourceItem;
    /** The plugin's package name, which every result names. */
    readonly plugin: string;
    /** The input the call was made with, so `failed[]` can be held against the cursor it must not advance. */
    readonly input: Readonly<Record<string, unknown>>;
    /** True for a detail read, which answers one event: it has no cursor to hold back. */
    readonly detail?: boolean | undefined;
}
/** The page's problems, by concern. */
export interface PageChecks {
    /** The authority's problems: the envelope, every event, the drops, `gap` and `cost`'s shape. */
    readonly shape: readonly string[];
    /** `failed[]` holds the cursor back. */
    readonly cursor: readonly string[];
    /** `gap`'s shape is the authority's; this stays for the round-trip the kit also checks. */
    readonly gap: readonly string[];
    /** A refused id is never also an event, and an event holding a secret is refused. */
    readonly refused: readonly string[];
    /** `cost` is reported by a billed source. */
    readonly cost: readonly string[];
}
/** The page's problems, by concern. */
export declare function pageChecks(answer: unknown, options: PageOptions): PageChecks;
/** Every problem with a page, one sentence each. */
export declare function pageProblems(answer: unknown, options: PageOptions): string[];
