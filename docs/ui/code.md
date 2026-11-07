# FM Evaluator Frontend Architecture Source of Truth

Status: Active  
Scope: Frontend architecture, runtime layers, data flow, refactor direction, technical debt map  
Owner: Frontend architecture  
Last Reviewed: 2026-11-03 (references updated; stack list, bootstrap and parsing sections reviewed 2026-09-29, the rest 2025-02-14)  
Supersedes: older migration plans centered on `main.js` removal  
See also: `docs/ui/design.md`, `docs/README.md`, `docs/quality-and-guardrails.md`, `docs/language.md`, `docs/workflows/extract-module.md`

## 1. Purpose

This document defines the current and target frontend architecture for FM Evaluator. It is intentionally explicit about the fact that the codebase is not done. It already runs on a modern React-first stack, but significant hybrid debt remains.

## 2. Current-State Reality

### Current stack

The stack is listed in `docs/README.md` (section 2, "Current stack"). In addition:

- `tsconfig.json` is not yet at the final strictness target and should move toward stricter typing over time
- selective legacy `.js` modules still under `src`

### Current architecture shape

The repo is React-first in runtime, but not yet cleanly layered.

The current application contains:

- React UI components and hooks,
- TS modules that handle storage, processing, orchestration and bridges,
- legacy `.js` modules that still participate in parsing, mapping and compatibility concerns,
- a compatibility layer that still exposes selected functionality through `window` bridges.

### Main problem statement

The core architectural debt is now a hybrid monolith, not a single deleted legacy file.

The biggest pain points are:

- large orchestration-heavy modules,
- mixed responsibilities between UI, parsing, mapping, processing and state,
- legacy file and naming boundaries that do not map cleanly to modern ownership,
- old comments and docs that imply the migration is effectively finished when it is not.

## 3. Runtime Entry Points

### React entry path

- `index.html` loads `src/main.tsx`
- `src/main.tsx` mounts the React app
- `src/App.tsx` drives the current primary shell and initializes `src/lib/legacyBootstrap.ts` from a mount effect

### Legacy bootstrap path still in use

- `src/lib/legacyBootstrap.ts` wires imperative legacy modules, parser helpers, schema globals, storage modules and `runtime.ts`
- this is the current bridge between the React shell and older imperative subsystems
- the archived pre-React page and its 5-line entry (index.legacy.html, src/main.ts) were removed in 2026-09

The practical conclusion: when working on today’s runtime behavior, inspect `main.tsx`, `App.tsx`, `lib/legacyBootstrap.ts` and `runtime.ts`.

## 4. Key Subsystems

### Storage layer

Main locations:

- `src/storage/db.ts`
- `src/storage/state.ts`
- `src/storage/migrations.ts`
- `src/ldcStorage.ts`

Important realities:

- Dexie database name: `fm-evaluator`
- current schema version: `v5`
- important tables include `settings`, `files`, `audit`, `uiState`, `ldcSettings`, `ldcMappings`, `backups`
- backup and restore already exist, using base64 payload encoding
- cross-tab sync is implemented with `BroadcastChannel` via `fm-evaluator-dexie`
- DB health reporting and audit logging are already present
- localStorage still exists as fallback and legacy compatibility surface in parts of the app

Architecture rule:

- Dexie is the primary persistence boundary
- localStorage and sessionStorage should be treated as fallback or migration edges, not the aspirational primary model
- new non-Dexie persistence keys should use the `fm-evaluator-*` prefix
- `fm24-evaluator-*` keys are legacy compatibility debt and should not be expanded

### Worker architecture

Main locations:

- `src/workers/parser.worker.ts`
- `src/workerBridge/`
- `src/parsing/workerParser.ts`

Important realities:

- parser worker handles header extraction and batch parsing concerns
- `workerBridge/` provides parser bridge, circuit breaker and watchdog machinery
- worker communication uses Comlink
- worker use is already real, but uneven across the codebase
- some heavy logic still runs too close to UI or orchestration

Architecture rule:

- workers are for responsiveness and isolation, not symbolism
- bridge complexity must pay for itself
- prefer existing bridge abstractions before introducing another worker lifecycle path
- if a heavy path needs a fallback, make the timeout and degraded behavior explicit

### Schema and validation

Main locations:

- `src/processing/schemas.ts`
- `src/schema/contracts.ts`
- `src/schema/schemaRegistry.js`

Important realities:

- `processing/schemas.ts` contains important Zod schemas for parsed entities
- `schema/contracts.ts` defines validation contracts and helper validation entry points
- `schemaRegistry.js` remains a legacy but important source of field definitions and schema-oriented knowledge
- this area still carries overlap and needs eventual rationalization

Architecture rule:

- Zod remains the preferred trust-boundary validator
- legacy schema sources should be progressively made more explicit and more typed
- reduce overlap by clarifying which file owns field definitions, which owns runtime validation and which exists only for legacy compatibility

### Security architecture

Main locations:

- `security_headers.json`
- `vite.config.ts`
- `index.html`
- `service-worker.js`

Important realities:

- `security_headers.json` is the single source of truth for runtime security headers
- SRI is enforced for vendor assets referenced from `index.html`
- CSP forbids the usual shortcut pattern of remote CDN assets and inline sprawl
- service worker remains part of the offline model
- runtime assumptions around isolation and self-hosting are structural, not optional polish

Architecture rule:

- security constraints should be enforced in config and automation where possible, not left as prose alone

### Profile system and runtime diagnostics

Main location:

- `src/runtime.ts`

Important realities:

- runtime detects `full`, `lite` and `ts-only` style profile behavior
- `crossOriginIsolated`, IndexedDB availability and device/network capability influence behavior
- diagnostics, hard reset, SW health, DB health and feature-gating logic already exist
- this is one of the most important operational modules for understanding degradation behavior

### State and UI shell

Main locations:

- `src/store/`
- `src/stateSync.ts`
- `src/ui/`
- `src/components/`
- `src/hooks/useDataBoundary.ts`

Important realities:

- Zustand is the intended modern UI state layer
- `stateSync.ts` still matters where React and legacy behavior must stay aligned
- React components now render the primary shell, left rail, import status surfaces, file manager modal, analytical table and player details
- several `ui/` modules still carry imperative rendering or compatibility responsibilities
- `useDataBoundary.ts` is an important seam for import and data-loading flows and should stay easy to reason about
- `CompatibilityHost` still renders hidden DOM anchors and modal shells required by legacy listeners that have not yet been re-homed in React

## 5. Current Data Flow

The real data flow is hybrid. A useful current mental model is:

1. File upload starts in React-facing flows such as `src/App.tsx`, `src/hooks/useDataBoundary.ts`, `src/upload.ts` or import helpers.
2. Bootstrap and legacy-compatible runtime pieces are initialized through `src/lib/legacyBootstrap.ts`.
3. Parser and worker paths extract headers and parse content through `workerParser`, `parser.worker.ts` and related bridges.
4. Language detection and header mapping rely on `smartHeaderMapper.js`, language configs and schema knowledge.
5. User intervention may occur through format or header mapping modals when confidence is insufficient.
6. Parsed rows are normalized and validated through parser helpers, schemas and contracts.
7. Data and UI state are persisted through Dexie, with legacy fallback storage still present in some flows.
8. React UI, table orchestration and compatibility helpers render results and details, with some remaining imperative bridge surfaces.

Additional current realities:

- OCR and advanced analytics should be treated as worker-eligible workloads, not default main-thread work.
- language configs and UI translations serve different layers and should not be conflated.
- data-path debugging often requires checking both modern TS modules and legacy parsing or mapping helpers.

## 6. Target Architecture

### High-level direction

The target architecture is a React-first frontend with explicit layering:

- UI layer,
- domain and computation layer,
- import/parsing layer,
- persistence layer,
- worker/orchestration layer,
- compatibility layer kept as thin and temporary as possible.

### Layer goals

#### UI layer

- React components, hooks and presentation-specific view composition,
- no heavy computation,
- no ad hoc parsing rules,
- no direct dependence on large legacy orchestration modules where avoidable.
- desktop and mobile views should prefer rendering from the same table or data state rather than maintaining separate business-logic paths.

#### Domain and computation layer

- pure or near-pure logic for scoring, normalization, comparisons and transformations,
- small modules with clear contracts,
- testable without DOM concerns.
- preferred home for xValue, xWage, LDC, similarity and related analytical models once extracted cleanly

#### Import and parsing layer

- import coordination,
- file-shape interpretation,
- parsing helpers,
- mapping of source-language exports to internal structures,
- explicit validation boundaries.

#### Persistence layer

- Dexie-backed storage logic,
- explicit ownership of local or session storage fallbacks,
- local-first behavior as the default storage model,
- future cloud sync or identity concerns should layer on top of this rather than replacing it prematurely,
- no UI-heavy leakage into storage concerns.

#### Worker and orchestration layer

- off-main-thread work where there is a real performance or responsiveness benefit,
- Comlink-based bridge where workers are used,
- Pyodide-backed Python execution remains a valid option for advanced analytical workloads when it provides clear value over TypeScript implementations,
- graceful degradation rather than complexity for complexity’s sake.
- Dexie-backed reads or heavy analytics should not create unstable promise references inside render paths.

#### Compatibility layer

- legacy bridges remain only where migration debt still requires them,
- bridge code must be named as transitional debt,
- new feature work should avoid expanding the bridge surface unless unavoidable.

## 6.5 Naming and File-Shape Conventions

- React component files use `PascalCase`.
- React hooks use `useCamelCase`.
- Regular modules use `camelCase`.
- Worker files use `camelCase.worker.ts`.
- Directory naming is transitional; prefer local consistency and avoid repo-wide rename churn unless it unlocks real architectural clarity.
- Named exports are preferred for reusable modules unless a framework convention strongly argues otherwise.

## 6.6 Table and Detail-Surface Seams

- The main analytical table should be treated as a first-class architectural seam rather than just a rendered component tree.
- `usePlayerTable()` already exists as the primary table seam for column definitions, sorting, pagination and container references.
- Desktop should preserve semantic table rendering where practical.
- Mobile should prefer rendering the same underlying analytical state as cards or compact list items rather than re-inventing sorting or filtering logic.
- Player details should be treated as a master-detail extension of the table state, not as a disconnected mini-app.

## 7. Current Debt Map

### Priority large-module debt

- import-time orchestration: `src/data/parseHTMLWithNewSystem.ts` (mapping and modal driving) and `src/data/handleFiles.ts` (file handling)
- blurred ownership between `data`, `processing`, `parsing`, `mapping` and `schema`
- continued dependence on global `window.*` integrations in multiple legacy-compatible paths

Important nuance:

- the main problem is no longer a `main.ts` or `main.js` monolith
- `dataProcessor.ts` is a 431-line facade after the split into modules under `src/data/`; import-time modal and mapping orchestration now sits in `parseHTMLWithNewSystem.ts` and `handleFiles.ts`, which are the next refactor targets

### Legacy footprint

Legacy `.js` files still exist in areas such as:

- parsing,
- mapping,
- schema registry or adjacent helpers,
- older modal or compatibility utilities.

These files are not automatically wrong, but they are debt where they:

- duplicate TypeScript behavior,
- hide important contracts from the type system,
- force bridge logic or mixed calling conventions,
- make refactoring and reasoning harder.

The right direction is progressive replacement or narrowing, not blind deletion. A legacy `.js` file should disappear only once its behavior and contracts are actually absorbed into clearer TypeScript ownership.

### Directory semantics that need improvement

The repo currently contains several folders whose boundaries are understandable historically but weak architecturally:

- `data`
- `processing`
- `parsing`
- `mapping`
- `schema`
- `storage`
- `store`
- `ui`
- `components`

The goal is not a blind rename spree. The goal is to make ownership clearer over time and reduce overlap.

Important nuance:

- `storage` and `store` are close in name but not identical in responsibility today: `storage` is persistence-oriented, while `store` is UI-state oriented
- `processing`, `parsing` and `mapping` still overlap in the import pipeline, but they are not pure duplicates either
- the medium-term goal is clearer seams and less overlap, not necessarily collapsing everything into a single `/core` tree immediately

## 8. Important Patterns and Conventions

### Bootstrap and load order

Today’s important initialization order is:

1. React shell mounts via `main.tsx`
2. `App.tsx` triggers `lib/legacyBootstrap.ts`
3. legacy schema, mapping and format-inspector modules register globals
4. storage and runtime infrastructure come online
5. React and compatibility surfaces interact through shared state and targeted bridge points

If a change depends on globals like `SchemaRegistry`, `SmartHeaderMapper`, `FormatInspector` or `ModalQueue`, do not assume they exist before the bootstrap path completes.

Practical implications:

- if a bug appears only on first load, inspect bootstrap timing before changing business logic
- prefer a single explicit bootstrap hook over hidden module-top side effects when extending imperative integration
- when adding new async initialization, keep promise lifetimes stable and avoid render-created fetch or worker promises that can cause repeated suspense or re-entry problems

### Legacy state access

- inspect Zustand state first for modern UI behavior
- inspect `stateSync.ts` when React and legacy behavior need coordination
- persist UI state through `storage/state.ts` instead of ad hoc localStorage writes
- treat `window.*` reads and writes as transitional debt, not the first-choice architecture
- if state must survive reloads, prefer explicit persistence helpers over ad hoc component-local storage code

### Worker communication

- use the worker bridge APIs rather than ad hoc worker construction when a bridge already exists
- respect circuit breaker and watchdog behavior
- keep timeout and fallback semantics explicit
- prefer Comlink-backed worker APIs for non-trivial worker contracts; use raw `postMessage` only when the protocol is intentionally tiny or latency-critical
- if heavy Dexie or worker-backed reads feed React, prefer stable async orchestration in hooks, stores or cached loaders rather than creating promises inline during render

### TypeScript configuration posture

- path alias `@/*` maps to `src/*`
- the project still allows `.js` imports as part of migration reality
- strict typing is a target, not yet the achieved baseline
- type coverage should rise before or alongside major analytical complexity growth
- the long-term target is a `tsconfig.json` posture closer to strict mode once hybrid debt is reduced enough to make that sustainable

### React optimization posture

- do not treat `useMemo` as a default ritual for every derived value
- use `useMemo` selectively where it protects genuinely expensive derivations or stabilizes references that materially affect behavior
- common good candidates in this codebase include stable TanStack Table column definitions, expensive derived row models, mapping dictionaries and other large computed structures that would otherwise churn on every render
- `useMemo` is also reasonable when it helps keep worker-facing inputs, virtualization configuration or adapter-layer references stable across renders
- do not use `useMemo` to paper over architecture problems that should instead be solved by better state placement, smaller components, worker offload or clearer module boundaries
- when the real need is smoother user-perceived latency rather than memoized computation, prefer better state ownership, `useDeferredValue`, `startTransition` or moving work off the render path

### Virtualization posture

- the primary desktop table should remain virtualization-friendly
- the current React table path is still pagination-first; virtualization remains a performance direction rather than the active default path
- row height should stay stable in dense mode rather than depending on highly variable content expansion
- sticky headers and virtualization should be designed together, not as separate afterthoughts
- avoid per-row visual effects that substantially increase paint cost on very large datasets

### Code style posture

- prefer functional modules over classes
- prefer guard clauses over deep nesting
- prefer RORO-style object parameters for multi-argument functions when it improves readability
- prefer dedicated error types over ambiguous thrown values
- prefer `interface` over `type` where a stable object shape is being modeled

### Schema posture

- `src/schema/contracts.ts` and `src/processing/schemas.ts` should be treated as partially overlapping layers, not assumed to be identical duplicates
- `contracts.ts` currently acts more like boundary and config-contract validation, while `processing/schemas.ts` defines a large player-shape schema used in processing paths
- the direction should be rationalization and clearer ownership, not merging by force without understanding each current responsibility

### Parsing posture

- `htmlparser2` is the installed HTML parser; the main-thread import path also uses `DOMParser` (`parseHTMLWithNewSystem.ts`, `dataProcessor.ts`, `mergeData.ts`, `ldcLoading.ts`)
- `parse5` and SAX-style parsers are not dependencies; adding one is a dependency decision, not a default
- the parser worker and the main-thread fallback share `UniversalParser` (since 2026-09-29)
- keep cleanup for NBSP, ZWSP, BOM and locale-formatting noise explicit

## 9. Storage and Validation Direction

### Storage

- Dexie remains the primary persistence abstraction.
- IndexedDB via Dexie remains the correct default for the current product shape: self-hosted, offline-first and browser-local.
- Storage choices and fallbacks should be described in architecture docs and rules, not multiplied across plans.
- Storage logic should stay clearly separate from presentation concerns.
- Supabase is reserved as a future option for authentication and cross-device sync if those product capabilities become real requirements.
- Supabase is not the current source of truth for user data, app state or local analysis history.

### Validation

- Zod remains the preferred boundary-validation tool for important input/output contracts.
- The codebase should continue moving away from ambiguous, shape-guessing logic when crossing import, storage and processing boundaries.
- Type coverage and stricter TypeScript configuration should increase over time as migration debt is reduced.

## 10. Worker Direction

- parser and heavy-compute work should stay eligible for worker execution where justified
- worker architecture is a means to preserve responsiveness, not a goal by itself
- worker complexity should be justified by real file sizes, compute cost and UX value
- fallback and degradation paths must remain explicit and user-safe
- Pyodide should be treated as an advanced-analysis capability, not as the default execution path for ordinary application logic
- if Pyodide is used, it should run in a worker, respect self-hosting constraints and degrade cleanly when runtime isolation or browser capabilities are insufficient

## 11. Localization Architecture Direction

- UI language and file-language configuration must remain separate concepts
- `public/i18n/messages` and `public/config/languages` serve different purposes and should not be blurred together
- hardcoded user-facing strings in UI modules should be treated as quality debt unless intentionally exempted

## 11.5 Common Change Surfaces

Useful entry points when navigating the codebase:

- persistence behavior: `src/storage/db.ts`, `src/storage/state.ts`, `src/storage/migrations.ts`
- runtime capability or degraded behavior: `src/runtime.ts`
- parser or processor worker orchestration: `src/parsing/workerParser.ts`, `src/workers/parser.worker.ts`, `src/workerBridge/`
- modern UI shell behavior: `src/App.tsx`, `src/components/`, `src/hooks/`, `src/store/`
- import or upload behavior: `src/upload.ts`, import helpers, data-boundary hooks and mapping modules
- schema or validation behavior: `src/processing/schemas.ts`, `src/schema/contracts.ts`, `src/schema/schemaRegistry.js`

Use these as navigation hints, not as a substitute for tracing the actual call path.

## 12. Current vs Target Summary

| Area                  | Current state                                             | Target state                                                                    |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| UI runtime            | React-first but partially hybrid                          | React-first with cleaner module ownership                                       |
| Main orchestration    | Several large modules still carry too much responsibility | Smaller orchestrators with clearer collaborators                                |
| Parsing and mapping   | Mixed TS and legacy JS                                    | More explicit and more consistently typed boundaries                            |
| Computation logic     | Partly modular, partly entangled with orchestration       | More pure, smaller, easier-to-test modules                                      |
| Storage               | Dexie-based with some mixed persistence concerns          | Clearer persistence boundary                                                    |
| Cloud or auth posture | No active backend dependency in core runtime              | Optional Supabase layer only if auth or sync becomes a real product requirement |
| Worker model          | Present but unevenly distributed                          | Intentional off-main-thread use where justified                                 |
| Compatibility layer   | Still visible and necessary in places                     | Thinner and steadily shrinking                                                  |

## 13. Architecture Review Questions

Every meaningful structural change should be checked against these questions:

- does it reduce or increase the hybrid monolith,
- does it clarify layer ownership,
- does it isolate logic from UI better than before,
- does it reduce reliance on legacy bridges,
- does it improve testability,
- does it respect self-hosting and runtime constraints,
- does it leave the code easier for future maintainers to navigate.
