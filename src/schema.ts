/**
 * The `sources` descriptor validator: the top-level `sources` key of a source plugin's package.json, contract version
 * 1 (design app#2346 §2.2).
 *
 * The package's `schema` entry exports it:
 *
 *   const checked = SOURCES_SCHEMA.check(pkg.sources)
 *
 * The schema is written in zod and stays inside the package: this module exports the validator and the plain types,
 * and `npm run build` writes the generated JSON Schema to `dist/schemas/sources.json`. The rules a JSON Schema cannot
 * express are in the conformance kit (`declarationProblems`).
 */
import { validator } from "./internal/validator.ts"
import type { Validator } from "./internal/checked.ts"
import { sourcesSchema } from "./internal/schema/sources.ts"
import type { Sources } from "./internal/schema/types.ts"

export { MAX_BYTES_DEFAULT, MAX_BYTES_LIMIT } from "./internal/schema/types.ts"
export type {
  Accounts,
  Cadence,
  Cost,
  Detail,
  DetailField,
  Permission,
  PermissionEvents,
  PermissionTool,
  Price,
  Scope,
  SourceCommon,
  SourceEvents,
  SourceItem,
  SourceSnapshot,
  Sources,
  Suggest,
} from "./internal/schema/types.ts"

/** The validator for a plugin's `sources` declaration, contract version 1. */
export const SOURCES_SCHEMA: Validator<Sources> = validator("sources", sourcesSchema)
