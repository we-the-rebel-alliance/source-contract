# `schemas`

Every JSON Schema the package publishes, by name. `npm run build` writes each one to `dist/schemas/<name>.json`, and a
release attaches the directory as one bundle.

```js
import { SCHEMAS } from "@we-the-rebel-alliance/plugin-contract/schemas"

for (const schema of SCHEMAS) console.log(schema.name, schema.jsonSchema())
```

The bundle holds the manifest (`capabilities.json`), every registry output (`output.<name>.json`), the core fact types
(`fact.<type>.json`), the hint frontmatter (`hint.json`) and the audit report (`audit.json`). A module that adds a
validator adds it to `SCHEMAS` in `src/schemas.ts`, and the build writes its JSON Schema; the JSON Schema is generated
from the zod source of truth, never written by hand.

A consumer that validates a value itself reads the same JSON Schema from this bundle; one that renders an output reads
it from the registry in `outputs`. See [manifest](manifest.md), [outputs](outputs.md), [hints](hints.md) and
[audit](audit.md).

## Exports

| Export | Does |
|---|---|
| `SCHEMAS` | every published validator, in bundle order: the manifest, the outputs, the facts, the hint and the audit report |
