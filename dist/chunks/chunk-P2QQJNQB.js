// @we-the-rebel-alliance/plugin-contract 0.0.0. Built by scripts/build.mjs; do not edit.
import {
  toJSONSchema
} from "./chunk-AYJEC7Y2.js";

// src/internal/validator.ts
function pathText(path) {
  if (path.length === 0) return "the value";
  return path.map((part, index) => typeof part === "number" ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`).join("");
}
function problemsOf(error) {
  return error.issues.map((issue) => `${pathText(issue.path)}: ${issue.message}`);
}
function validator(name, schema) {
  let generated;
  const check = (value) => {
    const result = schema.safeParse(value);
    return result.success ? { ok: true, value: result.data } : { ok: false, problems: problemsOf(result.error) };
  };
  return {
    name,
    check,
    parse(value) {
      const checked = check(value);
      if (checked.ok) return checked.value;
      throw new Error(`${name}: the value breaks the schema:
- ${checked.problems.join("\n- ")}`);
    },
    jsonSchema() {
      generated ??= toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" });
      return structuredClone(generated);
    }
  };
}

export {
  problemsOf,
  validator
};
