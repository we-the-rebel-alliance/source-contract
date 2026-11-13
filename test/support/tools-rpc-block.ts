/**
 * A plugin block for the shared suites: what v2's PLUGIN-SPECIFIC block exported, as the names the family's suites
 * import, and the `plugin` value the package's `registerToolsRpc` takes. Its next steps are gws's, word for word; it
 * has no MCP method and identity shapers, as gws's block does. `NEXT_STEPS` is one mutable object, read at each call,
 * so a suite that deletes or adds a step sees the module follow, as it did with the module-level export.
 */
import { toolsRpcId, type McpResult, type MethodSpec, type ShapeCall, type ToolsRpcPlugin } from "../../src/tools-rpc.ts"

export const PLUGIN_ID = "demo.plugin"
export const TOOLS_RPC_ID = toolsRpcId(PLUGIN_ID)
export const METHODS: readonly MethodSpec[] = []

export const NEXT_STEPS: Record<string, string | undefined> = {
  SESSION_UNKNOWN: `Create a session in the location you mean, such as POST /api/session with {"agent":"build"} sent with the header "x-opencode-directory: <dir>" or the location[directory] query, and pass its id.`,
  SESSION_AGENT_REQUIRED: `Create a session that names an agent this project has, with its project as the location, such as POST /api/session with {"agent":"build","location":{"directory":"/path/to/project"}}, and pass its id.`,
  PERMISSION_DENIED: "Add an allow rule for the action to the session's agent or to the session, or use a session whose agent allows it.",
  CANCELLED: "Call the method again if you still need the result.",
}

export function shapeInput(_method: string, input: unknown, _call: ShapeCall): unknown {
  return input
}

export function shapeResult(_method: string, result: McpResult, _call: ShapeCall): McpResult {
  return result
}

export function pluginError(_error: unknown): undefined {
  return undefined
}

export const PLUGIN: ToolsRpcPlugin = { id: PLUGIN_ID, nextSteps: NEXT_STEPS as ToolsRpcPlugin["nextSteps"], shapeInput, shapeResult, pluginError }
