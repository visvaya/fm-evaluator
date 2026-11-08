# FM Evaluator Quality and Guardrails

Status: Active  
Scope: Quality policy, verification, enforcement, testing, linting, accessibility and documentation-to-tooling mapping  
Owner: Project documentation  
Last Reviewed: 2026-11-07  
See also: `docs/README.md`, `docs/language.md`, `docs/adr/`, `.oxlintrc.json`

## 1. Purpose

This document is the active source of truth for quality expectations and their enforcement map. It explains:

- what the project expects from tests, reviews and verification,
- what is already enforced automatically,
- what is still manual,
- what gaps remain open.

## 2. Verification Baseline

### Expected checks for meaningful changes

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`
- relevant Playwright coverage for critical user flows when behavior changes
- targeted review of security, i18n and accessibility impact where applicable

### Dependency health checks

- `pnpm run quality` should remain code-focused and deterministic.
- `pnpm run quality:deps` should remain separate because it depends on live registry state and security advisory feeds.
- `pnpm run deps:report` should be treated as an informational version-drift report, not a code-quality signal.
- `pnpm audit` and `pnpm outdated` should not be folded into the baseline `quality` script.
- pnpm (12) runs dependency build scripts only for packages listed in `allowBuilds` in `pnpm-workspace.yaml` (`pnpm approve-builds` edits it); all pnpm settings live in that file, not in `package.json`. `pmOnFail: ignore` keeps pnpm's own version out of `pnpm-lock.yaml`, so GitHub's dependency graph can read it and Dependabot raises alerts.
- Build-script approvals should stay explicit for native/tooling-sensitive packages rather than being approved wholesale.
- Accepted upstream peer lag should be documented explicitly, but `pnpm peers check` may still report upstream package ranges until those packages update their own peer metadata.

### Package-age safety policy

- New `npm` and `pnpm` package releases are not adopted until they are at least 3 days old; `minimumReleaseAge: 4320` in `pnpm-workspace.yaml` enforces this during resolution, and the Dependabot cooldown (7 days) is longer.
- This 3-day buffer exists as a supply-chain safety guard against freshly published compromised packages.
- A critical security fix younger than that goes in through a per-package `minimumReleaseAgeExclude` entry that names the advisory and a removal date.
- “latest” does not automatically mean “recommended”; dependency reviews should distinguish registry latest from the newest version old enough to satisfy the 3-day policy.

### Critical-path expectation

The application should keep its critical user path healthy:

1. import data,
2. confirm or correct import interpretation,
3. inspect table output,
4. apply filters/sorts/interactions,
5. inspect player details and advanced analysis where relevant,
6. persist expected UI state and settings,
7. work under degraded or offline conditions when expected by the feature.

## 3. Testing Strategy

### Unit and integration tests

- Use Vitest for modules with clear logic boundaries.
- Prefer focused tests for parsing, mapping, storage, validation, scoring and bridge logic.
- Large orchestration modules should gain tests as they are broken down, not stay protected only by smoke coverage.
- Values typed `any` are tracked by the type-aware lint rules `typescript/no-explicit-any` and `typescript/no-unsafe-*` (errors; findings that existed on 2026-11-07 are frozen in `oxlint-suppressions.json`). They replaced the `type-coverage` script, whose floor was `0`.

### E2E tests

Playwright should primarily cover:

- import flow,
- format/header mapping flow,
- state persistence,
- modal and dialog behavior,
- accessibility-sensitive keyboard/focus paths,
- offline/degraded-state behavior where meaningful.

### What “complete enough” means

The suite does not need shallow tests everywhere. It does need strong coverage on:

- parsing correctness,
- schema boundaries,
- storage and recovery behavior,
- UI flows that users actually depend on,
- abuse-resistant behavior around malformed input and degraded runtime conditions.

## 4. Accessibility Baseline

Accessibility is part of correctness.

Minimum expectations:

- WCAG 2.2 AA target for active UI work.
- visible focus states,
- keyboard-operable interactive flows,
- reduced-motion respect where motion exists,
- live-region updates for long-running operations,
- usable fallback presentation for data visualizations,
- mobile and narrow-width usability without information loss.

## 5. Localization Quality Policy

Localization quality is not optional once UI strings are user-facing.

Required direction:

- avoid hardcoded user-facing strings where the UI already has an i18n path,
- keep message catalogs and file-language configs distinct,
- define fallback behavior explicitly,
- track missing keys and untranslated strings as quality issues.

## 6. CSS and Design Token Hygiene

The project should prefer design-token and scalable-unit discipline over arbitrary styling.

Expected direction:

- prefer `rem` for spacing and typography unless a specific API requires absolute units,
- document where pixel-based values are intentional, such as virtualization row heights or canvas math,
- prefer CSS variables/design tokens over one-off values,
- keep styling aligned with the active design direction in `docs/ui/design.md`.

## 7. Duplicate, Dead and Drift Control

This repo needs active control over duplication and drift.

Current concerns:

- duplicated or overlapping schema definitions,
- mixed legacy and modern module ownership,
- historical docs describing removed architecture,
- potential dead files as architecture evolves.

Expected controls:

- keep duplicate detection tooling active,
- review dead-file findings before deletion,
- treat doc drift as a real maintenance problem,
- avoid parallel “source of truth” documents for the same scope.

## 8. Timeout and Long-Test Policy

Tests and quality checks should be slow only when the scenario truly requires it.

Expected review questions:

- is a timeout protecting a real slow path or masking a hang,
- is a test serial for a good reason,
- is E2E coverage redundant with unit/integration coverage,
- are retries hiding instability,
- are setup costs repeated unnecessarily between tests.

## 9. Security Review Expectations

Security-sensitive changes require review for:

- self-hosting policy violations,
- CSP/SRI/header regressions,
- unsafe runtime assumptions,
- injection/XSS surface,
- leaking of local or imported data,
- unsafe logging or path handling,
- worker and storage misuse.

Security is covered partly by tooling, but always needs human review on important changes.

## 10. Enforcement Map

### Already enforced or partially enforced

- oxlint (`.oxlintrc.json`, `pnpm run lint`, in CI and `pnpm run quality`): type-aware through `oxlint-tsgolint`, the `correctness` category as errors, no warning budget (every rule is an error or off), unused disable directives fail; JS plugins `sonarjs`, `regexp`, `fp`, `zod`, `i18next` and `playwright`. Findings that existed on 2026-11-07 (5835 in 266 files) are frozen in `oxlint-suppressions.json`, generated once with `oxlint --suppress-all`; a new finding fails, and so does a frozen one that is gone until `pnpm run lint:prune` removes it
- React Hooks rules (native `react` rules: Rules of Hooks, exhaustive deps and the React Compiler checks; 28 existing hits frozen, 2026-11-07)
- JSX accessibility rules (native `jsx-a11y` rules on `src/**/*.tsx`; 49 existing hits frozen, 2026-11-07)
- hard-coded UI strings in TSX (`eslint-plugin-i18next` `no-literal-string`, mode `jsx-only`: JSX text plus `aria-label`, `title`, `placeholder`, `alt`; tests excluded; 325 existing hits in 21 files frozen, 2026-11-07)
- message catalogs (`src/i18n/messages.test.ts`): valid JSON, keys sorted at every level, `pl.json` with exactly the keys of `en.json`, no catalog with keys that `en.json` lacks
- unit-test coverage floors (`pnpm run test:coverage`, `@vitest/coverage-v8`; thresholds in `vitest.config.ts` just below the values measured 2026-09-30: statements 54, branches 50, functions 52, lines 55; CI and `pnpm run ci` run coverage instead of the plain test run)
- axe checks in E2E (`e2e/a11y.spec.ts`, `@axe-core/playwright`, WCAG 2.1 A/AA tags): no `serious` or `critical` violations on the main view and the player-details drawer after importing `sample-attributes-pl.html`; allowlist by rule id in the spec (today only `color-contrast`, 19 nodes). Runs in CI with the rest of E2E
- TypeScript compiler checks (`strict: false`; the individual strict flags `alwaysStrict`, `noImplicitThis`, `strictBindCallApply` and `strictBuiltinIteratorReturn` are on, because they reported zero errors on 2026-09-30)
- TypeScript strictness ratchet (`pnpm strict:metrics:check`, in CI and `pnpm run quality`): counts the errors `tsc --strict` with the six target flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) would report, in total, per error code and per file, against `scripts/strict-metrics.baseline.json` (776 errors in 149 files on 2026-11-08; 210 of them under `--strict` alone); fails on any rise and on a fall without `pnpm strict:metrics:update`
- focused-test protections (`vitest/no-focused-tests`, `playwright/no-focused-test`)
- import rules and import cycles (`import/no-cycle` without a depth limit, which replaced dependency-cruiser's `no-circular`)
- no classes outside tests (`max-classes-per-file` with a maximum of 0; existing classes frozen, one finding per file)
- layer boundaries (`no-restricted-imports` per directory: `src/computing` imports nothing from `src/ui`, React, components, Dexie or `src/storage`, and `no-restricted-globals` and `no-restricted-properties` keep it from reading `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `Date.now` and `Math.random`, with 12 frozen reads in `ldcMappings.ts`; `src/config` imports nothing from `src/ui`, `src/computing`, `src/storage` or `src/processing`)
- E2E in CI (since 2026-10-01, step "E2E tests" of the "Quality gate" job): the whole Playwright suite against `vite preview` of the build, which sends the headers from `security_headers.json`; runs on pull requests that change `src/`, `e2e/`, `public/`, `index.html`, build or test config, `package.json` or the lockfile (`.github/scripts/ci-scope.sh`), and always on `main`, weekly and on manual runs; the HTML report is uploaded as an artifact on failure
- docs-only pull requests skip the heavy CI steps inside the job (format, `docs:check` and `check:typography` still run), so the required check always reports
- JS bundle budget in `pnpm run check:dist` (after `pnpm run build`, in CI and `pnpm run ci`): prints the total size of `dist/assets/*.js` and the largest chunk on every run and fails above the limits in `scripts/lib/bundle-budget.mjs` (about 10% over the 2026-10-01 measurement: total 1,139,635 B, largest chunk 1,089,103 B). Raising a limit is deliberate: rebuild, read the printed sizes, change `BUNDLE_BUDGET` in the pull request that grows the bundle and give the reason in the commit body
- typography check (`pnpm run check:typography`, in CI on every run including docs-only pull requests, in `pnpm run quality` and in lint-staged for staged files): fails on the em dash (U+2014) and emoji (`\p{Emoji_Presentation}` or U+FE0F) in tracked text files outside `goldens/`, `e2e/fixtures/` and `public/vendor/`. Code that must keep the em dash as data (range parsers, missing-value placeholders) writes it as the `\u2014` escape
- workflow audit (zizmor, pedantic persona, pinned by wheel checksum) and SAST (Semgrep CE, `p/typescript` and `p/react`, image pinned by digest; fails only on ERROR severity; baseline 2026-10-01: 74 rules on 400 files, 0 findings of any severity) in the same job, on pull requests that touch `.github/`, `package.json` or the lockfile, and always on `main` and weekly; third-party actions pinned to commit SHAs and updated by Dependabot (weekly, grouped, 7-day cooldown)
- SRI validation scripts (exist, but not run in CI or `pnpm run ci`: `sri:check` and `validate:all` are manual only, checked 2026-09-29)
- config validation scripts (same: manual only)
- duplication/dependency audit scripts
- git hooks: lint-staged (oxlint and oxfmt on staged files) before a commit, commitlint on the message, typecheck and `pnpm test` before a push

### Not enforced today

- hard-coded user-facing strings outside JSX (plain `.ts` and `.js` modules)
- `rem` versus `px` policy
- test timeouts
- architectural heuristics such as RORO, guard clauses and minimal `useEffect`/`useState`
- import order (`import-x/order` left with ESLint; oxfmt can sort imports, not enabled yet)
- naming of types, parameters and enum members (`id-match` checks only variable and function names)
