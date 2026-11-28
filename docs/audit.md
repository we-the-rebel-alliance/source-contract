# `audit`

The audit report answers the question an auditor asks first: for one person, what may each installed plugin read and do,
and who granted it? It is built from the installed manifests, the person's access level per plugin and the grant records
the host keeps. It is evidence only: the report carries declarations and grant bindings, never provider content, a
credential or a token (contract §15; issue #94). `renderAuditReport` turns the report into deterministic Markdown for an
auditor.

```ts
import { AUDIT_SCHEMA, auditReport, renderAuditReport } from "@we-the-rebel-alliance/plugin-contract/audit"
import { listInstalledPlugins } from "@we-the-rebel-alliance/plugin-contract/catalog"

const listing = await listInstalledPlugins(ctx)
const report = auditReport({
  person: "ana@example.com",
  plugins: listing.plugins,
  access: { demo: "ask-changes" },
  grants: [
    {
      consumer: "notes",
      source: "demo.messages",
      account: "default",
      scope: { channels: ["C1"] },
      manifestHash: listing.plugins[0]!.hash,
      person: "ana@example.com",
      grantedAt: "2026-11-28T09:00:00Z",
    },
  ],
})

AUDIT_SCHEMA.check(report) // { ok: true, value: report }
const markdown = renderAuditReport(report) // the report as Markdown for an auditor
```

`plugins` takes the catalog's `CatalogPlugin[]` or any `InstalledManifest[]`. `access` maps a plugin's name to its
`options.access` level; a plugin it does not name is `all`. A grant record is a read `Grant` or an `ActGrant` from
`access`, with `person` and `grantedAt` beside it, because the grant types carry neither.

## What the report holds

- **Per plugin:** its package, version and manifest hash, and the access level the person has for it.
- **Every source:** its id, reading method, declared operations, whether that method takes an account, whether it reads
  personal content, and its cost.
- **Every action:** its id, preview and commit methods, the operations those methods declare, and its confirmation rule.
  A non-`local` action always needs the person's confirmation; a `local` one may carry it.
- **Every method:** its class, its own declared `effect` when it has one, and what the access level gives it: `runs`,
  `asks first` or `off`. The last comes from `effectFor`, the same function the access rules use, so the report cannot
  drift from the rules a call meets.
- **Under each source or action:** every grant behind it, with its consumer, account, canonical scope, manifest hash,
  whether it is disabled, the person who granted it and when, and `stale: true` when its manifest hash is not the
  installed one. A stale or disabled grant is kept: it is part of the evidence, not an error.

A grant whose plugin is not installed, or whose source or action is not declared by the installed plugin, is not
dropped: it is listed in `problems` with its binding and one sentence saying what is missing. `auditReport` never throws
for such a grant.

## Markdown

`renderAuditReport(report)` writes one section per plugin: a methods table, a table of what it may read and a table of
what it may do. Every read or action row names the grant behind it: consumer, account, scope, granted at and granted by.
A stale or disabled grant is marked in its cell, and every entry under `problems` is marked as a problem at the end.

The output is deterministic: the same report makes the same bytes. Provider text is data, so a pipe or a newline in a
grant's scope is escaped and cannot break a table.

## Exports

| Export | Does |
|---|---|
| `auditReport`, `renderAuditReport`, `AuditInput`, `AuditReport` | `auditReport(input)` builds one person's report from installed plugins, access levels and grant records; `renderAuditReport(report)` renders it as deterministic Markdown |
| `AUDIT_SCHEMA`, `AuditPlugin`, `AuditSource`, `AuditAction`, `AuditMethod`, `AuditAccess` | the report's validator, published as `dist/schemas/audit.json`, and the plugin, source, action and method shapes |
| `AuditGrantBinding`, `ReadGrantRecord`, `ActGrantRecord`, `AuditGrantRecord`, `AuditProblem` | a grant as the report shows it, the read and action records it is built from, and a grant that could not be placed |
