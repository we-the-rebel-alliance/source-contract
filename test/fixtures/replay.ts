/**
 * A recorded `events_list` as a function: each recorded input answers its recorded result, or throws its recorded
 * error's first line. An input that was never recorded throws `NOT_RECORDED` and is listed in `missed`, so a runner
 * can tell a replay that strayed from the recording from a source that refused.
 */
import { readdirSync, readFileSync } from "node:fs"
import type { ConformanceFixtures, EventsListInput } from "../../src/events.ts"

export interface RecordedCall {
  readonly input: EventsListInput
  readonly result?: Record<string, unknown>
  readonly error?: string
}

export interface RecordedRun {
  readonly fixtures: ConformanceFixtures
  readonly calls: readonly RecordedCall[]
}

export interface Fixture {
  readonly plugin: string
  readonly source: string
  readonly recordedFrom: { readonly repo: string; readonly commit: string; readonly test: string }
  readonly runs: readonly RecordedRun[]
}

/** JSON with every object's keys sorted, so an input's key does not depend on the order its fields were written. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

/** The fixtures in this folder, by file name without `.json`. */
export function loadFixtures(): Map<string, Fixture> {
  const dir = new URL("./", import.meta.url)
  const out = new Map<string, Fixture>()
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) out.set(name.slice(0, -5), JSON.parse(readFileSync(new URL(name, dir), "utf8")) as Fixture)
  return out
}

/** The run's `events_list`, with `transform` applied to each recorded result (the identity by default). */
export function replay(run: RecordedRun, transform: (result: Record<string, unknown>) => Record<string, unknown> = (result) => result) {
  const answers = new Map<string, RecordedCall>()
  for (const call of run.calls) answers.set(stableJson(call.input), call)
  const missed: EventsListInput[] = []
  const list = async (input: EventsListInput): Promise<unknown> => {
    const call = answers.get(stableJson(input))
    if (!call) {
      missed.push(input)
      throw new Error("NOT_RECORDED: this input was not recorded. Next step: Record the fixture again.")
    }
    if (call.error !== undefined) throw new Error(call.error)
    return transform(structuredClone(call.result!))
  }
  return { list, missed }
}
