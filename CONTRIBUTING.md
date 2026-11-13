# Contributing

This repository holds the source contract (design: [app#2346](https://github.com/we-the-rebel-alliance/app/issues/2346#issuecomment-6853030617)). Memory, the plugin family, Artifacts and the app each own a part; [CODEOWNERS](.github/CODEOWNERS) says who reviews what.

## Set up and check

You need Node 22.18 or later and Bun 1.4.4.

```sh
npm ci --ignore-scripts
npm run check
```

`npm run check` runs what CI runs:

| Step | What it proves |
|---|---|
| `npm run typecheck` | The sources and tests typecheck under strict settings. |
| `npm run build` | `dist/` is built: one bundled ES module per export, the declarations, the JSON Schemas and the notices of what is bundled. |
| `npm run check:dist` | `dist/` imports only Node built-ins, its declarations name nothing outside the package, and every export loads from a bare copy on Node and on Bun. |
| `npm test` | The tests pass on Node (`node --test`) and on Bun (`bun test`). Tests use `node:test` and `node:assert`, which both run. |
| `npm run conformance:self-test` | The conformance kit accepts every example under `examples/`, from `dist/` as it ships. |

## The rules

- **No install-time dependencies.** Anything the package uses is bundled into `dist/` (zod included); at run time it needs only Node built-ins. `package.json` has `devDependencies` only.
- **zod is the source of truth, and it stays inside.** A module writes its schema in zod and exports a `Validator<T>` (`src/internal/validator.ts`), never the zod schema: a published declaration that names zod would need zod installed. Add the validator to `SCHEMAS` in `src/schemas.ts`, and the build writes its JSON Schema to `dist/schemas/`.
- **One entry per module.** Each module is `src/<name>.ts` and an export `"./<name>"` in `package.json`, `{ "types": "./dist/<name>.d.ts", "default": "./dist/<name>.js" }`. Internal code lives in `src/internal/`.
- **`dist/` is committed.** A consumer pins a tag (`github:we-the-rebel-alliance/source-contract#vX.Y.Z`), and the install must run no build. Run `npm run build` and commit `dist/` with your change; CI fails when it differs. On a conflict in `dist/`, take either side and run `npm run build` again.
- **Node and Bun.** Write portable code: no Bun-only or Node-only APIs outside `node:` modules both support.
- **Words.** Plain British English in docs, comments and messages, with no contractions. An error message is the family's form: `CODE: what happened. Next step: …`.

## Releases

Releases are tagged GitHub Releases, not npm. A tag `v<package.json version>` on a main commit whose CI passed runs [the release workflow](.github/workflows/release.yml), which attaches the packed package, the conformance kit as one file, the schema bundle and `SHA256SUMS`. Only the owner decides a Release; an agent never pushes a tag on its own.
