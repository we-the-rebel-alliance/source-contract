/**
 * How a module exposes a schema: zod is the source of truth inside the package, and it never leaves it.
 *
 * zod is bundled into `dist/`, so a consumer installs nothing. For the same reason no public type may name zod: a
 * `.d.ts` that imports "zod" would need zod installed. A module therefore exports a `Validator<T>`, whose type is plain
 * TypeScript, and the JSON Schema generated from the zod schema (`jsonSchema()`; `npm run build` writes every schema
 * in `SCHEMAS` to `dist/schemas/`). `npm run check:dist` fails when a published `.d.ts` reaches a package import.
 */
import * as z from "zod"
import type { Checked, Validator } from "./checked.ts"

export type { Checked, Validator } from "./checked.ts"

/** A path as a person reads it: `items[2].title`, or `the value` for the root. */
export function pathText(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "the value"
  return path
    .map((part, index) => (typeof part === "number" ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`))
    .join("")
}

/** zod's issues as one sentence each, path first. */
export function problemsOf(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${pathText(issue.path)}: ${issue.message}`)
}

/** A `Validator` over a zod schema. Internal: modules export the validator, never the zod schema. */
export function validator<S extends z.ZodType>(name: string, schema: S): Validator<z.output<S>> {
  let generated: Record<string, unknown> | undefined
  const check = (value: unknown): Checked<z.output<S>> => {
    const result = schema.safeParse(value)
    return result.success ? { ok: true, value: result.data } : { ok: false, problems: problemsOf(result.error) }
  }
  return {
    name,
    check,
    parse(value) {
      const checked = check(value)
      if (checked.ok) return checked.value
      throw new Error(`${name}: the value breaks the schema:\n- ${checked.problems.join("\n- ")}`)
    },
    jsonSchema() {
      generated ??= z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as Record<string, unknown>
      return structuredClone(generated)
    },
  }
}
