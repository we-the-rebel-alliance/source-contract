/**
 * The audit report as Markdown for an auditor (issue #95).
 *
 * One section per plugin: its methods and the access level's effect, a table of what it may read, and a table of what
 * it may do. Every row names the grant behind it: consumer, account, scope, granted at and granted by. A stale or
 * disabled grant is marked in the grant cell, and a grant that does not fit an installed plugin is a marked problem at
 * the end. The output is deterministic: the same report renders the same bytes. Provider text is data: a pipe or a
 * newline in a scope is escaped, so it cannot break a table.
 */
import type { AuditReport } from "./report.js";
/** Render one audit report as deterministic Markdown. */
export declare function renderAuditReport(report: AuditReport): string;
