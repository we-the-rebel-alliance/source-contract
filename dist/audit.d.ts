/**
 * `audit`: what each installed plugin may read and do for one person, and the grant behind each declaration (contract
 * §15; issue #94). The report is evidence for an auditor: declarations and grant bindings only, never content, a
 * credential or a token.
 *
 *   const report = auditReport({ person, plugins: listing.plugins, access: { demo: "ask-changes" }, grants })
 *   AUDIT_SCHEMA.check(report) // the same shape, published as dist/schemas/audit.json
 *
 * A grant for a plugin, source or action that is not installed is kept in `problems` with its binding, never dropped
 * and never thrown. `docs/audit.md` is the guide.
 */
export { AUDIT_SCHEMA, auditReport } from "./audit/report.js";
export type { ActGrantRecord, AuditAccess, AuditAction, AuditGrantBinding, AuditGrantRecord, AuditInput, AuditMethod, AuditPlugin, AuditProblem, AuditReport, AuditSource, ReadGrantRecord, } from "./audit/report.js";
