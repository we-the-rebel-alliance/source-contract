import type { Checked } from "./internal/checked.js";
import type { ParamSpec } from "./params.js";
/** The most bytes a source may declare for one answer (1 MB), and the default when it declares none (64 KB): `events`' `MAX_BYTES`. */
export declare const MAX_BYTES_LIMIT: number;
export declare const DEFAULT_MAX_BYTES: number;
/** Who may be asked, and how (design §2.2 `permission`). */
export interface SourcePermission {
    /** An events source's method action, such as `gws.events_list`. */
    readonly events?: string;
    /** A snapshot source's method action, such as `gws.calendar_today`. */
    readonly tool?: string;
    /** What the read does at the provider: what grants and a person's off switches key on. */
    readonly operations: readonly string[];
    /**
     * The action each operation is asserted under, on the resource `<account>:<operation>`, such as `gws.read`. Without
     * it, each operation is itself an action, asserted on `*` (an MCP tool such as `slack_slack_read_channel`).
     */
    readonly operationAction?: string;
    /** The source's `probe`: its action and the operations it asserts, which must read no content. */
    readonly probe?: {
        readonly action: string;
        readonly operations?: readonly string[];
    };
}
/** A detail read: a declared read per event, whose inputs come only from the event's API fields. */
export interface SourceDetail {
    readonly id: string;
    readonly tool: string;
    /** The event fields its inputs come from: `external_id`, `thread`, `thread_channel` or `thread_ts`. */
    readonly from: readonly string[];
    /** The scope key the unit must sit in, such as `channels`: a detail never reads outside the confirmed scope. */
    readonly within?: string;
    readonly permission?: {
        readonly tool: string;
        readonly operations?: readonly string[];
        readonly operationAction?: string;
    };
}
/** One source a plugin declares. */
export interface SourceItem {
    readonly id: string;
    readonly kind: "events" | "snapshot";
    /** The tools-RPC method a read calls. */
    readonly tool: string;
    /** Fixed input the method always gets, such as `{ "source": "gmail" }`. */
    readonly input?: Readonly<Record<string, unknown>>;
    /** An events source's event kind. */
    readonly reads?: string;
    /** A snapshot source's output, a registered schema. */
    readonly output?: string;
    readonly params?: Readonly<Record<string, ParamSpec>>;
    readonly accounts?: {
        readonly named?: boolean;
    };
    readonly scope?: {
        readonly keys: readonly string[];
        readonly describe?: string;
        readonly suggest?: Readonly<Record<string, unknown>>;
    };
    readonly details?: readonly SourceDetail[];
    readonly permission: SourcePermission;
    readonly private?: boolean;
    readonly cost?: {
        readonly class: "free" | "metered" | "billed";
        readonly units?: readonly {
            readonly per: string;
            readonly usd: number;
        }[];
        readonly probe?: {
            readonly per: string;
            readonly usd: number;
        };
    };
    readonly cadence?: {
        readonly providerMinMinutes?: number;
    };
    readonly maxBytes?: number;
    readonly maxAgeSec?: number;
    readonly retentionDays?: number;
    readonly urlHosts?: readonly string[];
    readonly [key: string]: unknown;
}
/** The `sources` key. */
export interface SourcesDescriptor {
    readonly contractVersion: number;
    readonly items: readonly SourceItem[];
}
/** A descriptor as read from an installed package. */
export interface InstalledDescriptor {
    /** The package's name and version, from the same package.json. */
    readonly package: string;
    readonly version: string;
    /** The package's directory on disk. */
    readonly directory: string;
    readonly sources: SourcesDescriptor;
    /** `sha256:` and the hex digest of the canonical JSON of `sources`. */
    readonly hash: string;
}
/** The `sources` value checked against the frame; its problems, one sentence each, when it breaks it. */
export declare function checkSources(value: unknown): Checked<SourcesDescriptor>;
/** Canonical JSON: object keys sorted at every depth, no spaces. Arrays keep their order. */
export declare function canonicalJson(value: unknown): string;
/** The descriptor's hash: `sha256:` and the hex digest of its canonical JSON. Key order does not change it. */
export declare function descriptorHash(value: unknown): string;
/**
 * The descriptor of the package installed at `directory`: its package.json's `sources`, checked and hashed. With
 * `version`, the package.json must say that version, so a consumer reads the package it believes is installed.
 */
export declare function readInstalledDescriptor(directory: string, options?: {
    readonly version?: string;
}): Checked<InstalledDescriptor>;
/**
 * The directory of the package `name` as Node would find it installed from `from`: the nearest
 * `node_modules/<name>/package.json` at or above it. Undefined when none is installed.
 */
export declare function findInstalledPackage(name: string, from: string): string | undefined;
/** A source by id, from a descriptor. */
export declare function findSource(descriptor: SourcesDescriptor, id: string): SourceItem | undefined;
/** The most bytes one answer of this source may take: its `maxBytes`, or 64 KB. */
export declare function maxBytesOf(source: Pick<SourceItem, "maxBytes">): number;
