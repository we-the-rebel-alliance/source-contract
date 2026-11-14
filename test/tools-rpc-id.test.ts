// The tools-RPC id (source-contract#4): `<plugin id>.tools`, checked against the 24 family plugins' own ids.
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { isToolsRpcId, PLUGIN_ID_PATTERN, pluginIdOf, registerToolsRpc, toolsRpcId, toolsRpcIdProblems } from "../src/tools-rpc.ts"
import { PLUGIN } from "./support/tools-rpc-block.ts"

/** The plugin ids the 24 family plugins register today (each one's PLUGIN_ID). */
const FAMILY = [
  "affinity.crm", "ashby.recruiting", "boxd.machines", "browse", "charts", "elevenlabs", "github.platform", "granola.meetings",
  "google-workspace.gws", "history.sessions", "inference.core", "jira.issues", "jobs.scheduler", "linear.workspace",
  "metaview.workspace", "notion.workspace", "openrouter.models", "plaud.recordings", "slack.workspace", "tavily.web",
  "utilities.local", "voice.dictation", "wisprflow.meetings", "x.posts",
]

describe("the tools-RPC id", () => {
  test("is <plugin id>.tools for every family plugin, and gives the plugin id back", () => {
    assert.equal(FAMILY.length, 24)
    for (const id of FAMILY) {
      assert.ok(PLUGIN_ID_PATTERN.test(id), id)
      assert.ok(isToolsRpcId(toolsRpcId(id)), id)
      assert.equal(pluginIdOf(toolsRpcId(id)), id)
    }
    assert.equal(toolsRpcId("google-workspace.gws"), "google-workspace.gws.tools")
  })

  test("refuses what is not one", () => {
    for (const bad of ["google-workspace.gws", ".tools", "Gws.tools", "gws..tools", "gws tools.tools", "gws.tools.", 7, undefined]) assert.equal(isToolsRpcId(bad), false, String(bad))
    assert.equal(pluginIdOf("gws"), undefined)
  })

  test("a descriptor's declared id is checked, and against describe when the consumer has it", () => {
    assert.deepEqual(toolsRpcIdProblems("google-workspace.gws.tools"), [])
    assert.deepEqual(toolsRpcIdProblems("google-workspace.gws.tools", { id: "google-workspace.gws.tools" }), [])
    assert.deepEqual(toolsRpcIdProblems("google-workspace.gws.tools", { id: "slack.workspace.tools" }), [
      "the plugin's describe reports the tools-RPC id slack.workspace.tools, not google-workspace.gws.tools",
    ])
    assert.equal(toolsRpcIdProblems("gws").length, 1)
  })

  test("registration refuses a plugin id that is not lowercase dotted words", async () => {
    const ctx = { rpc: { register: async () => ({ dispose: async () => {} }) }, permission: { hook: async () => ({ dispose: async () => {} }) } }
    await assert.rejects(registerToolsRpc(ctx as never, { plugin: { ...PLUGIN, id: "Google Workspace" }, methods: [] }), /must be lowercase dotted words/)
    const stop = await registerToolsRpc(ctx as never, { plugin: { ...PLUGIN, id: "google-workspace.gws" }, methods: [] })
    await stop()
  })
})
