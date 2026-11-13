/** A tool the plugin declares, as its manifest lists it. */
export interface ToolDeclaration {
    readonly id: string;
    /** True when the tool reads and never changes anything. §2.2: every tool a source names is declared read-only. */
    readonly readOnly?: boolean | undefined;
}
/** What `declarationProblems` needs beyond the declaration itself. */
export interface DeclarationOptions {
    /** The plugin's declared tools, so a named tool can be checked. Omit it when the list is not at hand. */
    readonly tools?: readonly ToolDeclaration[] | undefined;
}
/** The verbs a read's name, and a provider operation, may carry. `fetch` is not one: it can send data out. */
export declare const READ_VERBS: readonly string[];
export declare const WRITE_VERBS: readonly string[];
/** Tokens that join two actions in one name (`get_and_save`): a name is one action, so these are refused. */
export declare const JOINERS: readonly string[];
/** The event kinds of contract version 1 (§2.1). A plugin adds `x-<plugin>/<kind>`. */
export declare const CORE_KINDS: readonly string[];
/** Every field of a contract-1 event. */
export declare const EVENT_FIELDS: readonly string[];
/** The event fields a `details` entry may take its input from: identifiers, never an event's own prose. */
export declare const DETAIL_FIELDS: readonly string[];
/**
 * Why a name is not a read's, or undefined when it is one: it carries no write verb anywhere and names one action.
 *
 * §2.2's rule is that a write verb in a name is refused, and that a compound name is refused; a name such as
 * `calendar_today` is a read's name without being a verb, so this check does not require one.
 */
export declare function nameProblem(name: unknown): string | undefined;
/** `nameProblem`, and the name must also carry a read verb. Memory's stricter form, for a read a consumer names. */
export declare function readVerbProblem(name: unknown): string | undefined;
/**
 * Why an operation is not a read's, or undefined when it is one.
 *
 * A dotted operation (`gmail.users.messages.get`) is a provider call, and its last segment's verb is the allowlist, so
 * `insert`, `batchModify`, `watch` and `untrash` are refused without being listed. A bare operation
 * (`slack_read_channel`) is an MCP tool name, and one of its words is the read verb. Either way, a write verb anywhere
 * is refused first.
 */
export declare function operationProblem(operation: unknown): string | undefined;
/**
 * Why a `urlHosts` pattern is too broad to mean anything, or null when it is fine.
 *
 * `urlHosts` is display hygiene: a consumer renders an event's `url` only when its host matches, so a pattern that
 * names a public suffix, a host anyone can claim, a tracker or a punycode lookalike would let collected text become a
 * remote image or a tracking link.
 */
export declare function urlHostProblem(host: unknown): string | null;
/**
 * Every problem with a `sources` declaration: the validator's first, then the rules it cannot express.
 *
 * @param sources the value of the top-level `sources` key
 * @param options the plugin's declared tools, when they are at hand
 */
export declare function declarationProblems(sources: unknown, options?: DeclarationOptions): string[];
/** `declarationProblems`, for a test or a check: throws one error listing every problem. */
export declare function assertDeclaration(sources: unknown, options?: DeclarationOptions): void;
