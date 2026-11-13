/**
 * The secret-pattern refusal (design §3, `events`: "the one normaliser and hash, and the secret-pattern refusal").
 *
 * Ported from Memory's `records/src/storable.js` (opencode-mem `main` at a70cda5, file SHA-256 0a1a0a37…c416),
 * `secretKinds` and its helpers, with type annotations only: the patterns and the decisions are Memory's, so an event
 * the library refuses is exactly one Memory's store would refuse (owner decision D3: a collected event that holds a
 * secret is never stored). Change it here and in Memory together; the test vectors in `test/events/secrets.test.ts`
 * pin the behaviour.
 */
/** A private key block, from its BEGIN line to its END line (or the end of the text). */
const PRIVATE_KEY_BLOCK = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g

/** Well-known credential shapes, found anywhere. Each match is checked for documentation. */
const SHAPED: readonly (readonly [string, RegExp, ((match: string) => boolean)?])[] = Object.freeze([
  // At a word start, with a key-like tail: 20 or more key characters, letters and digits.
  ["api key", /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g, (match) => /\d/.test(match.slice(3)) && /[A-Za-z]/.test(match.slice(3))],
  ["api key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g],
  ["api key", /\bAIza[0-9A-Za-z_-]{30,}/g],
  ["api key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["api key", /\b(?:AccountKey|SharedAccessKey)=[A-Za-z0-9+/]{20,}={0,2}/g],
  ["token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{8,}/g],
  ["token", /\bgithub_pat_[A-Za-z0-9_]{20,}/g],
  ["token", /\bglpat-[A-Za-z0-9_-]{16,}/g],
  ["token", /\bxox[bpars]-[A-Za-z0-9-]{10,}/g],
  ["token", /\bnpm_[A-Za-z0-9]{30,}/g],
  ["token", /\bhf_[A-Za-z0-9]{30,}/g],
  ["token", /\bdop_v1_[A-Za-z0-9]{40,}/g],
  ["token", /https:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9_/-]{20,}/g],
  ["token", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
])

/** `Bearer <token>`, `Authorization: <value>`, `x-api-key: <value>`. */
const BEARER = /\bBearer\s+([A-Za-z0-9._~+/=-]+)/gi
const AUTH_HEADER = /\b(?:authorization|x-api-key)\b["']?\s*[:=]\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s,;]+(?:[ \t]+[^\s,;]+)?))/gi

/** `user:password@host` inside a URL; the password may itself hold `@`. */
const CONNECTION = /\b[a-z][a-z0-9+.-]*:\/\/([^\s:@/]+):([^\s/]*)@[^\s@/]+/gi

const CREDENTIAL_KEYS =
  "api[_-]?key|apikey|access[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|private[_-]?key|passphrase|password|passwd|pwd|token|secret"

/**
 * An assignment of a credential: `password = hunter2`, `DB_PASSWORD="x"`,
 * `"api_key": "…"`, `password is: x`. The key may carry a prefix
 * (`OPENAI_API_KEY`), and the value may sit on the next line (pretty-printed
 * JSON, YAML). The value is checked by `credentialValue`, so prose
 * ("password: rotated quarterly", "token: 4096") and code
 * (`getToken(session)`) are not secrets.
 */
const ASSIGNMENT = new RegExp(
  String.raw`(?<![A-Za-z0-9])([A-Za-z0-9_.-]*?(${CREDENTIAL_KEYS}))["']?((?:[ \t]+(?:is|was))?[ \t]*[:=][ \t]*(?:\r?\n[ \t]*)?)(?:"([^"\n]*)"|'([^'\n]*)'|` + "`([^`\\n]*)`" + String.raw`|([^\s,;&]+))`,
  "gi",
)

const PLACEHOLDER =
  /^(?:\[[^\]]*\]|<[^>]*>|\{\{.*\}\}|\$\{?[A-Za-z_][\w.]*\}?|%[A-Za-z_]\w*%|\*+|x{3,}|\.{2,}|…|-+|true|false|null|nil|none|undefined|string|str|number|int|bool|required|optional|env|secret|password|token|redacted|placeholder|changeme|example|your[_-]?\w*|(?:process\.env|os\.environ|env)\b.*)$/i

/** The jwt.io sample token's payload and signature: documentation, not a credential. */
const JWT_IO_SAMPLE = /eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ|SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c/

/** Characters of a credential: no spaces, mostly token alphabet. */
const TOKENISH = /^[A-Za-z0-9._~+/=!@#$%^&*()\-:]+$/

/** A value or a token that is documentation: a placeholder, an example, a template. */
function documentation(value: unknown): boolean {
  const v = String(value ?? "").trim()
  return (
    PLACEHOLDER.test(v) ||
    /example/i.test(v) ||
    /x{4,}/i.test(v) ||
    /<[^>]*>/.test(v) ||
    /\byour[-_][\w-]*here\b/i.test(v) ||
    /\$\{|\{\{/.test(v) ||
    JWT_IO_SAMPLE.test(v) ||
    /[…]|\.{3}$/.test(v)
  )
}

/** A value that is code, not a literal: a member access, a call, a path, an environment read. */
function codeValue(value: unknown): boolean {
  const v = String(value ?? "").trim()
  return (
    // `session.accessToken`, `config.secretKey`: identifiers, not a random token with digits in it.
    (/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+;?$/.test(v) && (v.match(/\d/g) ?? []).length <= 2) ||
    /^(?:await\s+)?[A-Za-z_$][\w$.]*\(/.test(v) ||
    /^(?:~|\.{1,2})?\/[\w./-]*$/.test(v) ||
    /^(?:process\.env|os\.environ|import\.meta\.env)\b/.test(v)
  )
}

/** Shannon entropy of a string, in bits per character. */
function entropy(value: string): number {
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const p = count / value.length
    bits -= p * Math.log2(p)
  }
  return bits
}

/** A bare token: `min` or more token characters, a letter and a digit, not a word or a placeholder. */
function tokenShaped(value: unknown, min = 12): boolean {
  const v = String(value ?? "").trim()
  return v.length >= min && TOKENISH.test(v) && /\d/.test(v) && /[A-Za-z]/.test(v) && entropy(v) >= 3 && !documentation(v) && !codeValue(v)
}

/** Prose that a passphrase does not hold. */
const PROSE_WORDS = new Set(
  "a an the is are was were be been must should shall will can may not no never always every each at least most of to in on for and or with by from via see use uses used set stored managed rotated rotate required policy characters chars minimum maximum change changed expires expire reset same as one this that it its".split(" "),
)

/** `password: correct horse battery staple`: three to eight plain words, no prose, no full stop. */
function passphrase(rest: unknown): boolean {
  const line = String(rest ?? "").trim()
  if (line.length < 16 || /[.!?]$/.test(line)) return false
  const words = line.split(/\s+/)
  return words.length >= 3 && words.length <= 8 && words.every((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word) && !PROSE_WORDS.has(word.toLowerCase()))
}

/**
 * Whether the value of a credential assignment is one. A quoted value counts
 * from 4 characters (8 for a token or secret); a bare one needs 6 (8) and a
 * digit, a symbol or an inner capital, which a word of prose does not have.
 * A value in a URL query (`?token=…&`) needs 16 characters and the entropy of
 * a random token.
 */
function credentialValue(value: unknown, quoted: boolean, key: string, query: boolean): boolean {
  const v = String(value ?? "").trim()
  if (!v || documentation(v)) return false
  if (query) return tokenShaped(v, 16)
  const loose = /^(?:token|secret)$/i.test(key)
  if (quoted) return v.length >= (loose ? 8 : 4) && !/^\d+(?:\.\d+)?$/.test(v) && !/^[A-Za-z_$][\w$.]*\(|^\$\{/.test(v)
  if (codeValue(v) || !TOKENISH.test(v) || /^\d+(?:\.\d+)?$/.test(v)) return false
  if (v.length < (loose ? 8 : 6)) return false
  return /\d/.test(v) || /[^A-Za-z0-9]/.test(v) || /.[A-Z]/.test(v)
}

/** The kinds of secret in one piece of text: "private key", "api key", "token", "password", "connection string". */
export function secretKinds(text: unknown): string[] {
  const value = String(text ?? "")
  const kinds = new Set<string>()
  if (new RegExp(PRIVATE_KEY_BLOCK.source).test(value)) kinds.add("private key")
  for (const [kind, pattern, valid] of SHAPED) {
    for (const match of value.matchAll(pattern)) if (!documentation(match[0]) && (!valid || valid(match[0]))) kinds.add(kind)
  }
  for (const match of value.matchAll(BEARER)) if (tokenShaped(match[1])) kinds.add("token")
  for (const match of value.matchAll(AUTH_HEADER)) {
    const v = String(match[1] ?? match[2] ?? match[3] ?? "").trim().replace(/^(?:Bearer|Basic|Token|Bot)\s+/i, "")
    if (tokenShaped(v)) kinds.add("token")
  }
  for (const match of value.matchAll(CONNECTION)) if (match[2]!.length >= 3 && !documentation(match[2])) kinds.add("connection string")
  for (const match of value.matchAll(ASSIGNMENT)) {
    const key = match[2]!
    const quoted = match[4] ?? match[5] ?? match[6]
    const bare = match[7]
    const crossed = /\n/.test(match[3]!)
    // A value on the next line that is itself a key ("DB_HOST=x", "host:") is not this key's value.
    if (crossed && bare !== undefined && /^[A-Za-z_][\w.-]*[:=]/.test(bare)) continue
    // In a URL query (`?token=…&page=2`) the value must look random.
    const query = /[?&]/.test(value[match.index - 1] ?? "")
    const password = /pass|pwd/i.test(key)
    let found = credentialValue(quoted ?? bare, quoted !== undefined, key, query)
    if (!found && password && quoted === undefined && !query) {
      const start = match.index + match[0].length - (bare ?? "").length
      const end = value.indexOf("\n", start)
      found = passphrase(value.slice(start, end === -1 ? value.length : end))
    }
    if (found) kinds.add(password ? "password" : /token/i.test(key) ? "token" : "api key")
  }
  return [...kinds]
}
