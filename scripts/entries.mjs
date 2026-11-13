// The package's entry points, read from package.json `exports`, and the declarations they reach.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, normalize, relative, resolve } from "node:path"

/** `{ key, name, source, js, types }` for every export but ./package.json. */
export function entryPoints(pkg, root) {
  return Object.entries(pkg.exports)
    .filter(([key]) => key !== "./package.json")
    .map(([key, target]) => {
      const name = key === "." ? "index" : key.slice(2)
      if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`entries: the export "${key}" is not "./<lowercase name>"`)
      const js = `./dist/${name}.js`
      const types = `./dist/${name}.d.ts`
      if (target.default !== js || target.types !== types) throw new Error(`entries: the export "${key}" must be { "types": "${types}", "default": "${js}" }`)
      const source = join(root, "src", `${name}.ts`)
      if (!existsSync(source)) throw new Error(`entries: the export "${key}" has no src/${name}.ts`)
      return { key, name, source, js, types }
    })
}

/** Every relative module specifier a declaration or module file names, and every other specifier, apart. */
export function specifiers(text) {
  const found = []
  const patterns = [
    /\b(?:import|export)\s[^'"]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) found.push(match[1])
  return found
}

const files = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

/** The declaration files the exports reach, following relative imports. */
export function reachableDeclarations(pkg, dist) {
  const start = Object.entries(pkg.exports)
    .filter(([key]) => key !== "./package.json")
    .map(([, target]) => resolve(dist, "..", target.types))
  const seen = new Set()
  const queue = [...start]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    for (const specifier of specifiers(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) continue
      queue.push(`${normalize(join(dirname(file), specifier)).replace(/\.(?:d\.ts|ts|js)$/, "")}.d.ts`)
    }
  }
  return seen
}

/**
 * Removes every declaration file no export reaches, and the directories left empty, and points the declarations kept
 * at `.js` (tsc keeps the sources' `.ts` specifiers in declarations).
 */
export function pruneDeclarations(pkg, dist) {
  const keep = reachableDeclarations(pkg, dist)
  for (const file of files(dist)) {
    if (!file.endsWith(".d.ts")) continue
    if (!keep.has(file)) {
      rmSync(file)
      continue
    }
    const text = readFileSync(file, "utf8")
    const rewritten = text.replace(/(["'])(\.\.?\/[^"']*?)\.ts\1/g, "$1$2.js$1")
    if (rewritten !== text) writeFileSync(file, rewritten)
  }
  for (const dir of readdirSync(dist).map((entry) => join(dist, entry))) {
    if (statSync(dir).isDirectory() && files(dir).length === 0) rmSync(dir, { recursive: true })
  }
  return [...keep].map((file) => relative(dist, file))
}
