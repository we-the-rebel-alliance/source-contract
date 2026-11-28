/**
 * The audit report as Markdown for an auditor (issue #95).
 *
 * One section per plugin: its methods and the access level's effect, a table of what it may read, and a table of what
 * it may do. Every row names the grant behind it: consumer, account, scope, granted at and granted by. A stale or
 * disabled grant is marked in the grant cell, and a grant that does not fit an installed plugin is a marked problem at
 * the end. The output is deterministic: the same report renders the same bytes. Provider text is data: a pipe or a
 * newline in a scope is escaped, so it cannot break a table.
 */
import type { AuditGrantBinding, AuditReport, AuditSource } from "./report.ts"

const LINE_BREAK = /\r\n|\r|\n/g

/** A table cell: a newline cannot split a row, and a pipe cannot open a new column. */
function cell(value: string): string {
  return value.replace(LINE_BREAK, "<br>").replaceAll("|", "\\|")
}

/** A heading or a line outside a table: provider text stays on one line. */
function line(value: string): string {
  return value.replace(LINE_BREAK, " ")
}

/** A list in a cell, or `none` when it is empty. */
function list(values: readonly string[]): string {
  return values.length === 0 ? "none" : cell(values.join(", "))
}

/** The scope as canonical JSON: sorted keys and lists, with provider text escaped by JSON. */
function scopeText(scope: Readonly<Record<string, string | readonly string[]>>): string {
  return JSON.stringify(scope)
}

/** One grant's evidence, as a person reads it. */
function grantText(grant: AuditGrantBinding): string {
  const marks = [grant.stale ? "stale" : "", grant.disabled ? "disabled" : ""].filter((mark) => mark !== "")
  const suffix = marks.length === 0 ? "" : ` (${marks.join(", ")})`
  return `${grant.consumer} on ${grant.account}, scope ${scopeText(grant.scope)}, granted ${grant.grantedAt} by ${grant.person}${suffix}`
}

/** One read's cost, in the manifest's own words. */
function costText(cost: AuditSource["cost"]): string {
  const units = cost.units ?? []
  if (units.length === 0) return cost.class
  return `${cost.class}: ${units.map((unit) => `${unit.usd} USD per ${unit.per}`).join("; ")}`
}

/** A Markdown table with escaped cells. */
function table(headers: readonly string[], rows: readonly (readonly string[])[]): readonly string[] {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ]
}

/** Render one audit report as deterministic Markdown. */
export function renderAuditReport(report: AuditReport): string {
  const lines: string[] = [`# Audit report for ${line(report.person)}`, ""]
  for (const plugin of report.plugins) {
    lines.push(`## ${line(plugin.package)} ${line(plugin.version)}`, "")
    lines.push(`Manifest: ${line(plugin.manifestHash)}`, `Access: ${line(plugin.access)}`, "")
    lines.push("### Methods", "")
    const methods = plugin.methods.map((method) => [
      cell(method.method),
      cell(method.class),
      cell(method.effect ?? "none"),
      cell(method.access),
    ])
    lines.push(...table(["Method", "Class", "Declared effect", "Access"], methods), "")
    lines.push("### What it may read", "")
    if (plugin.sources.length === 0) {
      lines.push("No sources.", "")
    } else {
      const rows: string[][] = []
      for (const source of plugin.sources) {
        const declared = [
          cell(source.id),
          cell(source.method),
          list(source.operations),
          cell(source.accounts),
          source.private ? "yes" : "no",
          cell(costText(source.cost)),
        ]
        if (source.grants.length === 0) rows.push([...declared, "no grant"])
        else for (const grant of source.grants) rows.push([...declared, cell(grantText(grant))])
      }
      lines.push(...table(["Source", "Method", "Operations", "Accounts", "Private", "Cost", "Grant"], rows), "")
    }
    lines.push("### What it may do", "")
    if (plugin.actions.length === 0) {
      lines.push("No actions.", "")
    } else {
      const rows: string[][] = []
      for (const action of plugin.actions) {
        const declared = [
          cell(action.id),
          cell(action.preview),
          cell(action.commit),
          list(action.operations),
          cell(action.confirmation),
        ]
        if (action.grants.length === 0) rows.push([...declared, "no grant"])
        else for (const grant of action.grants) rows.push([...declared, cell(grantText(grant))])
      }
      lines.push(...table(["Action", "Preview", "Commit", "Operations", "Confirmation", "Grant"], rows), "")
    }
  }
  lines.push("## Problems", "")
  if (report.problems.length === 0) {
    lines.push("No problems.")
  } else {
    for (const problem of report.problems) {
      lines.push(`- **problem:** ${line(problem.problem)}. ${line(grantText(problem.grant))}`)
    }
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`
}
