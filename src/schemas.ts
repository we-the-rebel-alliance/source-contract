/**
 * Every schema the package publishes, by name. `npm run build` writes each to `dist/schemas/<name>.json`, and the
 * release attaches them as one bundle. A module that adds a validator adds it here.
 */
import type { Validator } from "./internal/checked.ts"
import { AUDIT_SCHEMA } from "./audit.ts"
import { HINT_SCHEMA } from "./hints.ts"
import { MANIFEST_SCHEMA } from "./manifest.ts"
import { OUTPUTS } from "./outputs.ts"
import { FACT_SCHEMAS } from "./internal/schema/facts.ts"
import { TELEMETRY_EVENT_SCHEMA } from "./telemetry.ts"

export const SCHEMAS: readonly Validator<unknown>[] = [
  MANIFEST_SCHEMA,
  ...Object.values(OUTPUTS),
  ...Object.values(FACT_SCHEMAS),
  HINT_SCHEMA,
  AUDIT_SCHEMA,
  TELEMETRY_EVENT_SCHEMA,
]
