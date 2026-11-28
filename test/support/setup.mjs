// A temporary data root for every test process, so a plugin's default event log never reaches a person's own
// OpenCode data. Node and Bun both load this before a test file; the directory is removed when the process exits.
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const directory = mkdtempSync(join(tmpdir(), "plugin-contract-tests-"))
process.env["XDG_DATA_HOME"] = directory
process.once("exit", () => {
  try {
    rmSync(directory, { recursive: true, force: true })
  } catch {
    // The test's own answer is what matters; a leftover temporary directory does not change it.
  }
})
