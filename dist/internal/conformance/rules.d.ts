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
/**
 * The verbs a read may be named with, as tokens of a name: `get`, `list`, `read`, `search`, `query`, `fetch`, `count`,
 * `describe`, `probe`, `export`, `instances`, `status`, `lookup`, `view`, `history`, `find`.
 *
 * `export` and `instances` are reads here because a provider's own operation says so (`drive.files.export`,
 * `calendar.events.instances`). A plugin whose write tool is named `export` is still a write: the declaration says
 * `readOnly: true` for a read, and that is what conformance checks.
 */
export declare const READ_VERBS: readonly string[];
export declare const WRITE_VERBS: readonly string[];
/** Tokens that join two actions in one name (`get_and_save`, `getAndSend`): a name is one action. */
export declare const JOINERS: readonly string[];
/**
 * A name split into tokens: on snake, kebab, dot and space, and at each camelCase boundary. `getAndSend` is
 * `get and send`, `gmail.users.messages.get` is `gmail users messages get`, and `batchGet` is `batch get`.
 */
export declare function tokensOf(name: unknown): string[];
/**
 * Why a name is not a read's, or undefined when it is one.
 *
 * The name's own verb is the first token that is a verb: a read verb makes it a read, a write verb refuses it. The verb's
 * position is not fixed, because a name may put it after a namespace (`events_list`, `slack_read_channel`) or lead with
 * it (`get_issue`). A write word in an object position is no verb at all here (`get_issue` is a read of an issue). A name
 * with no verb is a noun name (`calendar_today`), which §2.2's own tools allow.
 */
export declare function nameProblem(name: unknown): string | undefined;
/** `nameProblem`, and the name must carry a read verb. Memory's stricter form, for a read a consumer names. */
export declare function readVerbProblem(name: unknown): string | undefined;
/**
 * Why an operation is not a read's, or undefined when it is one.
 *
 * A dotted operation (`gmail.users.messages.get`) is a provider call, and its last segment is where its verb sits: the
 * first token of that segment that is a verb must be a read verb, so `insert`, `batchModify`, `watch`, `untrash` and
 * `emptyTrash` are refused without being listed, while `batchGet`, `export` and `instances` are reads. A bare operation
 * (`slack_read_channel`) is an MCP tool name and follows the same rule. An operation with no verb at all is refused: an
 * operation names how it reads.
 */
export declare function operationProblem(operation: unknown): string | undefined;
/** Every field of a contract-1 event. */
export declare const EVENT_FIELDS: readonly string[];
/** The event fields a `details` entry may take its input from: identifiers, never an event's own prose. */
export declare const DETAIL_FIELDS: readonly string[];
/**
 * The public suffix of a host, from the full Public Suffix List (ICANN and PRIVATE): the longest matching rule, where
 * `*.` matches one label and `!` is an exception. `a.b.co.uk` answers `co.uk`, and `shop.ondigitalocean.app` answers
 * `ondigitalocean.app`, because the PRIVATE section says so.
 */
export declare function publicSuffixOf(host: string): string | null;
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
