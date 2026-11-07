# Golden master for the import pipeline

The safety net for splitting the legacy layer (`window.*` bridges, `.js` modules, imperative DOM). Harness: `src/data/importPipeline.golden.test.ts`. Procedure: `docs/workflows/extract-module.md`.

## What is pinned

For every case: FM export HTML -> `parseImportedHtml` / `DataProcessor.parseHTML` (legacy parsers and mappers) -> `mergeData` -> `runAnalysis` for all 10 roles -> filtered and sorted table rows.

Every case runs on two parse paths. Both use the shared `UniversalParser`; only the transport differs:

- `fallback`: the synchronous `UniversalParser` (`src/parsing/`), used when no worker is available. Snapshots `<case>.<kind>.json`.
- `worker`: `src/workers/parser.worker.ts` behind the real `src/parsing/workerParser.ts`, run in-process; requests and results pass through `structuredClone` as with `postMessage`. This is the path the browser uses whenever it can start the worker (checked in Chromium on 2026-09-29 for the first row of `sample-attributes-pl.html`: position, foot, EU flag, wage and both dates match these snapshots). Snapshots `<case>.worker.<kind>.json`; scoring only for the Default engine, without per-stat details. The test fails if the worker path falls back to the main-thread parser.

No parser returns a `Date` today: date schema fields (`basic_dob`, `basic_expires`) hold `YYYY-MM-DD` strings and the displayed columns keep the FM text. If one ever does, the harness writes it as `<Date YYYY-MM-DDTHH:mm:ss.sss>` in local calendar fields instead of `{}`.

| File                   | Content                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `<case>.import.json`   | per file: detected language, column map, format context, parsed rows, import result                                  |
| `<case>.merged.json`   | merged player records before scoring                                                                                 |
| `<case>.analysis.json` | one line per engine and role (table order by UID), then one line per player with the fields scoring added or changed |

Per-stat details (`filters`, `statDetails`, `attrDetails`) are kept only for the Default engine of `fm-export-en-uk` and the two `sample-*` cases, because they dominate the file size.

## Fixtures

- `fixtures/fm-export-{en-uk,en-us,pl}.html`: the same 29 players, rows copied verbatim from three full FM exports (128 columns, attributes and statistics). Rows were chosen for format coverage: transfer value ranges, wages in `p/a` and `rocznie`, `Unknown`/`Nieznane`, masked attributes (`10-15`, `-`), short distances, every position group including goalkeepers. `.gitattributes` keeps their bytes unchanged. They contain Football Manager game data, which the project's MIT licence does not cover; the README screenshots in `docs/images/` are taken with this fixture.
- `e2e/fixtures/sample-{attributes,stats}-{en,pl}.html`: the synthetic E2E fixtures, imported as separate attribute and statistic files.

## Not covered

- Header-mapping and format-verification modals (the harness does not register them).
- The Web Worker and Comlink transport themselves (worker start-up, timeouts, circuit breaker in `src/workerBridge/`).
- OCR (`src/ocr/*`): no recognized-text sample exists yet. OCR modules are not extracted until one is recorded and pinned.

## Rules

- `pnpm test:goldens` must pass byte-identical after every extraction step.
- A diff is a behaviour change. If it is intended (a bug fix), run `pnpm test:goldens:update` and explain the diff in the same commit. Never regenerate only to turn a red test green.
- `pnpm run goldens:diff [<base-ref>]` (default `HEAD`) summarises the change for that explanation: per changed snapshot file, the changed leaf paths with array indices collapsed, how many leaves changed and one example `old -> new`. It reads JSON and JSON-lines snapshots.
- No extraction of code that no golden case exercises. Add a case first.
