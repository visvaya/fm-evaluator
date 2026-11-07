# FM Evaluator Documentation Index

Status: Active  
Scope: Documentation index, source-of-truth map, architecture reality  
Owner: Project documentation  
Last Reviewed: 2026-11-03  
See also: `docs/ui/design.md`, `docs/ui/code.md`, `docs/quality-and-guardrails.md`, `docs/language.md`, `docs/workflows/extract-module.md`

## 1. Project Snapshot

FM Evaluator is a self-hosted, offline-first Football Manager analysis application. The current frontend is React-first and TypeScript-first, built with Vite, Tailwind CSS v4, Dexie, Zod, Comlink, TanStack Table, Zustand and a legacy compatibility layer that still bridges older modules and plain `.js` code.

This document is the central index for project documentation. It does not try to duplicate every detailed rule or architecture note. Instead it answers:

- what is currently true in the repo,
- which documents are authoritative for which scope,
- where the history of the project is kept.

## 2. Current Architecture Reality

### Current stack

- Frontend: React 19, Vite 8, TypeScript 6, Zustand for state.
- Styling: Tailwind CSS v4 with design tokens in the OKLCH color space.
- Persistence: Dexie (IndexedDB).
- Processing: HTML exports are parsed with `DOMParser` on the main thread; the cell values are then parsed in a Web Worker through Comlink, with a main-thread fallback that uses the same parsers; Zod validates data at the boundaries; Tesseract.js reads possession screenshots (OCR).
- UI components: TanStack Table v8, Radix UI primitives, lucide-react icons, `@visx/scale` for chart scales.
- Every runtime asset (fonts, scripts, workers, WASM) is self-hosted under `public/vendor` or bundled; vendor files in `index.html` carry SRI hashes (`pnpm run sri:update`, `pnpm run sri:check`).

Also true today:

- Supabase is not part of the runtime; it remains a future option for authentication and cross-device sync.
- The main table is paginated (`usePlayerTable`); TanStack Virtual is used only in the LDC leagues list.

### Reality of the codebase

- `main.js` is gone. Any document treating `main.js` as the active center of the app is outdated.
- The codebase is still hybrid. There are React components, TS modules, large orchestration modules and legacy `.js` files under `src`.
- The main architectural problem is no longer one deleted file. The problem is a new hybrid monolith spread across `data`, `processing`, `parsing`, `mapping`, `schema`, `workerBridge` and legacy compatibility bridges.
- The active React UI coexists with legacy assumptions, naming, comments and compatibility code.
- The active React shell already owns the main app frame, table surface, details surface, left rail, file manager modal and import status banner, while a compatibility host still keeps hidden DOM anchors for legacy workflows.

### Current constraints that remain hard requirements

- No external CDNs.
- Self-hosted fonts, scripts, workers, WASM and vendor assets.
- Security headers remain mandatory.
- Offline-first behavior remains a project goal.
- Accessibility and degraded-state behavior are part of correctness, not polish.

## 3. Source of Truth Matrix

| Scope                               | Primary source of truth                                                                          | Supporting documents                                          | Notes                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Documentation index                 | `docs/README.md`                                                                                 | `README.md`                                                   | Central document index                                                 |
| UI and UX direction                 | `docs/ui/design.md`                                                                              | `docs/ui/mockup/`, `docs/quality-and-guardrails.md`           | Light-first, self-hosted, accessibility-aware direction                |
| Frontend architecture               | `docs/ui/code.md`                                                                                | `docs/ui/react-functional-parity-matrix.md`                   | Current vs target architecture and refactor direction                  |
| Legacy bridge reduction             | `docs/workflows/extract-module.md`                                                               | `docs/ui/code.md`, `goldens/README.md`                        | Procedure for replacing one `window.*` bridge at a time                |
| League difficulty coefficient (LDC) | `docs/domain/ldc.md`                                                                             | `src/computing/ldcStatApplication.ts`                         | Domain contract for every LDC change                                   |
| Quality and enforcement             | `docs/quality-and-guardrails.md`                                                                 | `eslint.config.mjs`, `.github/workflows/ci.yml`               | Testing, linting, verification, enforcement map                        |
| Localization                        | `docs/language.md`                                                                               | `src/i18n`, `public/i18n/messages`, `public/config/languages` | UI language, file-language configs, completeness policy                |
| Security and self-hosting           | `docs/adr/001-runtime-isolation-and-self-hosting.md`, `docs/adr/004-csp-sri-and-local-assets.md` | `security_headers.json`                                       | Hard constraints                                                       |
| Persistence and future sync posture | `docs/ui/code.md`                                                                                | `docs/README.md`                                              | Dexie now; Supabase later only if auth/sync is introduced deliberately |

## 4. Active Document Map

### Active documents

- `docs/README.md`: central index and architecture reality summary.
- `docs/ui/design.md`: active UI and interaction direction.
- `docs/ui/code.md`: active architecture and refactor direction.
- `docs/ui/react-functional-parity-matrix.md`: React parity checklist for legacy features.
- `docs/domain/ldc.md`: league difficulty coefficient contract.
- `docs/workflows/extract-module.md`: procedure for extracting a legacy module.
- `docs/quality-and-guardrails.md`: quality policy and enforcement mapping.
- `docs/language.md`: localization ownership and gaps.
- `goldens/README.md`: golden snapshots of import, scoring and the table.
- `scripts/compare-parse-paths.cjs`: compares worker and fallback golden snapshots (run from the repository root).
- `scripts/check-docs.mjs`: documentation hygiene check (unreferenced docs, dead file references, stale `Last Reviewed`).

## 5. ADR Status and Decision Registry

ADR policy, the active ADRs and the removed ones: `docs/adr/README.md`.

- Removed references to ADR-006, ADR-007 and ADR-008 should not be reintroduced unless real ADR files are created again for a durable reason.

## 6. Enforcement Map

### What is enforced automatically today

- ESLint catches a range of architectural, test and code-quality issues.
- Git hooks run lint and format on staged files, check commit messages and run typecheck and `pnpm test` before a push.
- CI runs `.github/workflows/ci.yml` and gitleaks in `.github/workflows/secrets.yml`; the full list of checks is in `docs/quality-and-guardrails.md` §10.

### What can be enforced further

- missing i18n keys and untranslated user-facing strings,
- CSS/token hygiene such as `rem` versus `px` policy,
- stronger checks for user-facing hardcoded strings,
- better duplicate-file and dead-file detection,
- clearer timeout and long-test policy.

### What cannot be replaced by automation alone

- architecture rationale,
- rejected alternatives,
- system-level constraints and their trade-offs,
- source-of-truth ownership across documents.

Automation is an enforcement layer, not a substitute for planning and architectural documentation.

## 7. History

The history of this repository starts on 2026-11-03.

## 8. Working Rules for Maintaining This Document

- Keep this file broad and navigational.
- Put detailed architecture decisions into `docs/ui/code.md` unless they clearly justify a durable ADR.
- Put detailed UI direction into `docs/ui/design.md`.
- Put quality policy and enforcement gaps into `docs/quality-and-guardrails.md`.
- When retiring an old document, first preserve any still-useful content in an active source-of-truth document.
