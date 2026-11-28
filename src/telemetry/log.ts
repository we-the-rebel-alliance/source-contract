/**
 * The local, append-only event log every plugin captures into (principles rule 1.4, decision 0005).
 *
 * One event is one JSON line, written and fsynced before `append` answers. A reader that reopens the path sees every
 * complete line; a torn tail from a crash is skipped rather than thrown at the reader. The log has no exporter: each
 * deployment chooses where the events go.
 *
 * `append` never throws into the caller. It validates the event against its catalogue and screens it for secrets before
 * it writes, and answers a refusal that names the problem; a disk that cannot be written answers `unavailable` and the
 * caller carries on. The log is not a queue shared between processes: one plugin writes one path.
 */
import { closeSync, existsSync, fchmodSync, fstatSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, writeSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { TELEMETRY_CATALOGUE, type TelemetryCatalogue, type TelemetryEvent } from "./definition.ts"
import { validateEvent } from "./validate.ts"

/** Where the log is and which catalogue it accepts. */
export interface EventLogOptions {
  /** The JSON Lines file. Its directory is created when it is missing. */
  readonly path: string
  /** The catalogue to validate against; the contract's by default. */
  readonly catalogue?: TelemetryCatalogue
}

/** What an append answers: the event's id, or why it was not written. */
export type EventLogAppendResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: "invalid"; readonly problems: readonly string[] }
  | { readonly ok: false; readonly reason: "unavailable" }

/** A log a plugin holds: append one event, or read the complete lines it has written. */
export interface EventLog {
  /** The resolved file path. */
  readonly path: string
  append(event: unknown): EventLogAppendResult
  /** Every complete event, oldest first. A torn or unreadable line is skipped. */
  read(): TelemetryEvent[]
}

/** Make a new file or directory survive a crash, where the platform allows it. */
function syncDirectory(directory: string): void {
  let fd: number | undefined
  try {
    fd = openSync(directory, "r")
    fsyncSync(fd)
  } catch {
    // Not every platform can open or fsync a directory.
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        // The append itself already succeeded; a close failure is not the event's.
      }
    }
  }
}

/**
 * Drop a trailing line without its newline, the shape a killed write leaves, so the next append starts on a line of
 * its own. A complete log is left untouched.
 */
function repairTornTail(path: string): void {
  let fd: number | undefined
  try {
    fd = openSync(path, "r+")
  } catch {
    return
  }
  try {
    const size = fstatSync(fd).size
    if (size === 0) return
    const last = Buffer.alloc(1)
    readSync(fd, last, 0, 1, size - 1)
    if (last[0] === 0x0a) return
    let end = size
    let truncate = 0
    while (end > 0) {
      const start = Math.max(0, end - 64 * 1024)
      const chunk = Buffer.alloc(end - start)
      readSync(fd, chunk, 0, chunk.length, start)
      const found = chunk.lastIndexOf(0x0a)
      if (found !== -1) {
        truncate = start + found + 1
        break
      }
      end = start
    }
    ftruncateSync(fd, truncate)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

/** Create the local event log at `path`. A path that is not a string is a programming error and throws here. */
export function createEventLog(options: EventLogOptions): EventLog {
  if (typeof options?.path !== "string" || options.path.trim() === "") throw new TypeError("telemetry: the event log needs a path")
  const path = resolve(options.path)
  const catalogue = options.catalogue ?? TELEMETRY_CATALOGUE

  return {
    path,
    append(event) {
      let checked
      try {
        checked = validateEvent(event, catalogue)
      } catch {
        return { ok: false, reason: "invalid", problems: ["the event could not be read"] }
      }
      if (!checked.ok) return { ok: false, reason: "invalid", problems: checked.problems }

      let line: string
      try {
        line = `${JSON.stringify(checked.value)}\n`
      } catch {
        return { ok: false, reason: "invalid", problems: ["the event is not JSON"] }
      }

      try {
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
        repairTornTail(path)
        const created = !existsSync(path)
        const fd = openSync(path, "a", 0o600)
        try {
          try {
            fchmodSync(fd, 0o600)
          } catch {
            // Some platforms have no POSIX modes; the write still matters.
          }
          const bytes = Buffer.from(line)
          let offset = 0
          while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset)
          fsyncSync(fd)
        } finally {
          closeSync(fd)
        }
        if (created) syncDirectory(dirname(path))
        return { ok: true, id: checked.value.id }
      } catch {
        return { ok: false, reason: "unavailable" }
      }
    },
    read() {
      try {
        const text = readFileSync(path, "utf8")
        const lines = text.split("\n")
        if (lines.at(-1) === "") lines.pop()
        const events: TelemetryEvent[] = []
        for (const line of lines) {
          if (line === "") continue
          try {
            const value: unknown = JSON.parse(line)
            const checked = validateEvent(value, catalogue)
            if (checked.ok) events.push(checked.value)
          } catch {
            // A torn or corrupt line is skipped, never thrown at the reader.
          }
        }
        return events
      } catch {
        return []
      }
    },
  }
}
