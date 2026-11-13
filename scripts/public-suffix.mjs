// Regenerates the Public Suffix List data the conformance kit bundles.
//
//   node scripts/public-suffix.mjs
//
// Fetches https://publicsuffix.org/list/public_suffix_list.dat (ICANN and PRIVATE sections) and writes it as generated
// data: one string split at load, so no quoted token confuses `npm run check:dist`. The list is MPL-2.0; its notice is
// in the module and in THIRD-PARTY-NOTICES.md.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const notice = readFileSync(join(root, "scripts", "public-suffix-notice.md"), "utf8").trimEnd()
const source = "https://publicsuffix.org/list/public_suffix_list.dat"
const response = await fetch(source)
if (!response.ok) {
  console.error(`PUBLIC_SUFFIX_UNAVAILABLE: ${source} answered ${response.status}. Next step: run this again when it answers.`)
  process.exit(1)
}
const rules = (await response.text())
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("//"))
const today = new Date().toISOString().slice(0, 10)

const file = `/**
 * The Public Suffix List, ICANN and PRIVATE sections, as generated data. Conformance only: \`schema\` checks a host's
 * syntax, and a plugin that bundles only the schema does not carry this file.
 *
 * Source: ${source}, fetched on ${today}. Rules keep their form: \`*.\` is a
 * wildcard on one label, and \`!\` is an exception. Regenerate with \`node scripts/public-suffix.mjs\`.
 *
 * The list is subject to the Mozilla Public License, v. 2.0: https://mozilla.org/MPL/2.0/. Its notice is attached to the
 * built package in THIRD-PARTY-NOTICES.md.
 */
const RULES = \`${rules.join("\n")}\`

/** Every rule of the list: a domain, \`*.\` a wildcard on one label, \`!\` an exception. */
export const PUBLIC_SUFFIX_RULES: readonly string[] = RULES.split("\\n")

/** The list's licence and source, for the notices a released package carries. */
export const PUBLIC_SUFFIX_NOTICE = \`${notice}\`
`
writeFileSync(join(root, "src", "internal", "conformance", "public-suffix-list.ts"), file)
console.log(`public suffix list: ${rules.length} rules written for ${today}`)
