# Contributing

Thank you for helping. FM Evaluator is maintained by one person, so small, focused pull requests are the easiest to review. For a larger change, open an issue first to agree on the approach.

## Setup

- Node.js 26, at least the version in `engines` in `package.json` (`.nvmrc` names the major line; CI uses its newest release)
- pnpm, in the version pinned by `packageManager` in `package.json`: Node.js 26 no longer ships Corepack, so run `npm install -g corepack` and `corepack enable`, or install that pnpm version directly

```bash
pnpm install
pnpm run dev
```

## Before you open a pull request

Run the full local gate, the same checks CI runs:

```bash
pnpm run ci
```

It checks formatting, lint, types, dead code, duplication, dependency rules, documentation links and typography, runs the production audit and the tests with coverage, then builds and checks the build output. Browser tests run in CI; to run one spec locally use `pnpm run e2e:local -- e2e/<file>.spec.ts`.

Project rules worth knowing before you start:

- No external CDNs: fonts, scripts, workers and WASM are served from the app's own origin, and the strict Content Security Policy in `security_headers.json` must keep working (no `eval`, no inline event handlers).
- Every user-facing text goes into both `public/i18n/messages/en.json` and `pl.json`, with sorted keys (`docs/language.md`).
- New tests that touch the DOM start with `// @vitest-environment jsdom`.
- Changes to import parsing or scoring must keep the golden snapshots byte-identical unless the change is intended; explain any snapshot change in the same commit (`goldens/README.md`).
- No em dashes and no emoji in tracked files (`pnpm run check:typography`).

More detail: `docs/README.md` (documentation index) and `docs/quality-and-guardrails.md`.

## Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, imperative, lower case, no trailing period, for example `fix(import): keep the club name when a column is empty`.
- Pull requests are squash-merged, so the pull request title becomes the commit on `main`.
- The required check is "Quality gate"; a pull request is merged after it passes and the maintainer has reviewed the change.

## Reporting a security problem

Do not open a public issue. Follow `SECURITY.md`.
