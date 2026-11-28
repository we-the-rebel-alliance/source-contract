import { type BusReader, type CallEnvironment } from "./invoke.js";
import { type RpcContext } from "./rpc.js";
/** The tool context an executor receives, as much of OpenCode's `ToolContext` as this module uses. */
export interface ToolCallContext {
    readonly sessionID: string;
    readonly agent: string;
    readonly messageID: string;
    readonly id: string;
    readonly signal: AbortSignal;
    readonly codemode?: boolean;
    readonly progress: (update: Readonly<Record<string, unknown>>) => Promise<void>;
}
/** The value schema and options a tool registration carries. */
export interface ToolRegistration {
    readonly name: string;
    readonly description: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly output: Readonly<Record<string, unknown>>;
    readonly options: {
        readonly namespace: string;
        readonly permission: string;
        readonly codemode: boolean | {
            readonly pinned?: boolean;
            readonly description?: string;
            readonly input?: unknown;
            readonly output?: unknown;
        };
    };
    execute(input: unknown, context: ToolCallContext): Promise<{
        readonly output: unknown;
        readonly content: string;
    }>;
}
/** The editor inside `ctx.tool.transform`, as this module uses it. */
export interface ToolEditor {
    namespace(namespace: {
        readonly name: string;
        readonly description: string;
    }): void;
    add(tool: ToolRegistration): void;
}
/** The part of the plugin context the tools use. */
export interface ToolContext {
    readonly permission: {
        assert(input: {
            readonly sessionID: string;
            readonly agent?: string;
            readonly action: string;
            readonly resources: readonly string[];
            readonly save?: readonly string[];
            readonly source?: {
                readonly type: "tool";
                readonly messageID: string;
                readonly id: string;
            };
        }): Promise<void>;
    };
    /** The session and agent the call runs as, read only to name the rule the gate evaluated. */
    readonly session: RpcContext["session"];
    readonly agent: RpcContext["agent"];
    /** The editor is `unknown` here because the host's `ToolEditor.add` is generic over each schema type; `installTools`
     * narrows it to `ToolEditor`, exactly as the accounts module narrows its transforms. */
    readonly tool: {
        readonly transform: (callback: (editor: unknown) => void) => Promise<{
            dispose(): Promise<void>;
        }>;
    };
}
/** The tool registrations, built once, so a test can inspect them before OpenCode runs them. */
export declare function toolRegistrations(environment: CallEnvironment, context: ToolContext, bus: BusReader): readonly ToolRegistration[];
/** Register every tool in the plugin's namespace, and return the registration to dispose. */
export declare function installTools(context: ToolContext, environment: CallEnvironment, bus: BusReader): Promise<{
    dispose(): Promise<void>;
}>;
