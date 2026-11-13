/**
 * `scope.suggest`: the read-only tool that lists the values a person may pick for a scope key. It runs only at bind,
 * in the probe session, and its results are shown and never stored, so it never enters a running grant.
 *
 * The kit checks the shape of its answer (`options`, each `{ id, label? }`), that every id is inside the confirmed
 * scope's declared shape, and that the tool asserts only the source's own grants.
 */
const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** One value a person may confirm. */
export interface ScopeOption {
  readonly id: string
  readonly label?: string | undefined
}

/** Every problem with a suggest answer, one sentence each. */
export function suggestProblems(answer: unknown, where: string): string[] {
  if (!plain(answer)) return [`${where} answered nothing: an object with options`]
  const problems: string[] = []
  const options = answer["options"]
  if (!Array.isArray(options)) return [`${where} options must be a list, empty when there is nothing to offer`]
  if (options.length > 64) problems.push(`${where} offered ${options.length} options, over 64`)
  const ids = new Set<string>()
  for (const [index, option] of options.entries()) {
    if (!plain(option) || typeof option["id"] !== "string" || option["id"].length === 0 || option["id"].length > 200) {
      problems.push(`${where} options[${index}] must be { id, label? }`)
      continue
    }
    if (option["label"] !== undefined && (typeof option["label"] !== "string" || option["label"].length > 200)) {
      problems.push(`${where} options[${index}].label must be at most 200 characters`)
    }
    if (ids.has(option["id"])) problems.push(`${where} offers ${option["id"]} twice`)
    ids.add(option["id"])
  }
  return problems
}
