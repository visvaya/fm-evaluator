# Replace a legacy bridge with an import

The legacy layer is a set of `window.*` bridges, `.js` modules and imperative DOM code that talk through globals and bootstrap order. Splitting it is a behaviour-preserving refactor: every import must produce the same parsed rows, scores and table order before and after, byte for byte.

**Unit of work: one `window.X` bridge replaced by an ES import.** A change that rewires two bridges, or rewires one and rewrites it, cannot be reviewed.

The method rests on golden fixtures, a metrics ratchet that may only fall and a codemap of `window.X` definitions and uses; the tools below implement it.

## Tools

| Command                          | What it answers                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm legacy:codemap`            | Which bridges exist, who defines and reads them, in what order to take them (depth, leaves first).       |
| `pnpm legacy:codemap --bridge X` | Every write and read site of `window.X`, plus test, E2E and HTML files that mention it.                  |
| `pnpm legacy:metrics`            | Ratchet values (bridges, writes, reads, `.js` files, `innerHTML` writes, legacy HTML/CSS, largest file). |
| `pnpm legacy:metrics:check`      | Fails if a value rose, or fell without the baseline being updated. Runs in CI.                           |
| `pnpm test:goldens`              | Import, scoring and table goldens (`goldens/README.md`). Must stay byte-identical.                       |
| `pnpm run goldens:diff [<ref>]`  | Structural diff of changed snapshots: leaf paths with collapsed indices, counts, one example each.       |

The codemap matches syntax, not scope. Verify every site in the code before acting on it.

## 1. Choose the bridge

1. Run `pnpm legacy:codemap`. Take the first bridge in "Bridges read in src/" whose row is not blocked below: lowest `DEPTH`, then `WDEPTH`, then fewest reading files.
2. Run `pnpm legacy:codemap --bridge X` and write down every site.
3. Search for re-declared copies the codemap cannot see: `git grep -nE "(class|function) X\b"`. A duplicate is not an edge, so it never shows up in the graph.
4. Skip, and pick the next one, if:
   - the definer or a reader lives in an area no golden covers (see step 2), or
   - the bridge is a write-only name (no reader in `src/`). Those are console APIs, inline HTML handlers or dead exports; removing them is a product decision, not an extraction.

## 2. Prove golden coverage (mutation probe)

"Never extract code no golden covers" is checked, not assumed:

1. `pnpm test:goldens` is green on a clean tree.
2. Make one small, deliberate behaviour change in the definer that alters the result for values the fixtures contain, for example `return clamp(num + 1)` instead of `return clamp(num)`. Probe each main branch (single value and range, for example) separately.
3. Run `pnpm test:goldens`. It must go red. Revert the change and confirm it is green again.
4. A green result can mean an equivalent mutant rather than missing coverage. For example, deleting the `value === '-'` check in `AttributeParser` stayed green because `'-'` still ended as `null` through `parseInt`. Before concluding "not covered", confirm the mutation changes the output for a fixture value.
5. If a non-equivalent mutation stays green, the code is not covered: add a golden case (fixture plus `CASES` entry in `src/data/importPipeline.golden.test.ts`) in a separate commit first, or pick another bridge.

Known gaps:

- The parser worker runs the shared `UniversalParser`; the goldens still run both paths (`fallback` and `worker` snapshots), so a parser change shows up in both.
- OCR (`src/ocr/*`): no recognised-text sample is pinned.
- Header-mapping and format-verification modals are not registered in the harness.
- Types no fixture reaches, on either path: `integer` (only `basic_age`, and no fixture has an age column; age comes from `DoB`) and `physical` (no schema field uses it).
- A parser whose `parse()` has no caller (`DistanceParser`: `UniversalParser.parseDistance()` is never called) is pinned only through its construction. Probe it by removing the global, which makes the `UniversalParser` constructor throw.

## 3. Read before touching

Read the definer and every reading file in full, not only the lines grep shows. Note for each reader:

- Existence guards (`if (window.X === undefined) throw ...`, `typeof window.X === 'function'`). With an import the value is always defined, so the guard becomes unreachable. That is fine when the guard only protected load order. When a fallback branch could run in production, preserve that behaviour through an adapter or skip the bridge; ask the owner only when the fallback is product behaviour.
- Whether the definer has top-level side effects beyond the `window` assignment (DOM queries, reads of other globals, registrations). An import evaluates the definer earlier than the bootstrap did. Pure class or function definitions are safe; anything else changes initialisation order: preserve the order through an adapter or skip the bridge.

## 4. Rewire (commit 1: move, no behaviour change)

1. In the definer, add a named export next to the existing class or function. Leave the code itself untouched.
2. In each reader in `src/`, import the name and replace `window.X` with it. Keep existence guards unless they only restate the import; if you remove one, say so in the commit body.
3. Keep the `window.X = ...` write while anything outside the rewired readers still uses it: test files, E2E specs (`page.evaluate`), `index.html`, documented console APIs. The codemap `TESTS` column and `--bridge` output list them.
4. Move tests that read `window.X` to the import when they test the module itself. Do not delete assertions.
5. When the last reader and test are gone, remove the write and its `interface Window` declaration in the same commit, together with the side-effect imports whose only job was to run the write: `src/lib/legacyBootstrap.ts` and `src/data/goldenLegacyGlobals.ts` (keep the two lists identical). Drop the matching `vi.doMock` entry in `src/lib/legacyBootstrap.test.ts`, whose list mirrors the bootstrap imports.
6. Do not convert `.js` to `.ts`, rename, reformat or fix lint findings in this commit.

## 5. Verify

Run the checks one at a time and write long outputs to a log file outside the repository:

1. `pnpm test:goldens`: byte-identical. A diff means the rewiring changed behaviour. Never run `test:goldens:update` to make it pass.
2. `pnpm exec vitest run <directories of definer and readers>`.
3. `pnpm run typecheck`.
4. `pnpm exec oxlint <touched files or directory>` (CI runs the full lint). Existing findings are frozen in `oxlint-suppressions.json`, so the command must pass: a new finding fails, and so does a frozen finding the change removed, until `pnpm exec oxlint --prune-suppressions <same paths>` lowers the baseline in the same commit. New files must be clean.
5. `pnpm legacy:metrics`: reads of the bridge must fall. Run `pnpm legacy:metrics:update` and commit the lower baseline in the same commit. If a value rose, the change added debt: fix it rather than raise the baseline.
6. `pnpm legacy:codemap --bridge X`: the rewired readers are gone.
7. Run the E2E specs that exercise the readers in a real browser, because the bundler evaluates modules in an order jsdom does not reproduce. For parsing and import: `pnpm run e2e:local -- e2e/import-flow.spec.ts e2e/processor-pipeline.spec.ts` (it starts its own server on a free port). Compare with the same specs on `main` on the same machine:
   - Browsers must be installed (`pnpm exec playwright install chromium`).
   - The first run after a cold start of the dev server can fail almost every test with `ERR_CONNECTION_REFUSED` or missing elements. Re-run before judging.
   - `import-flow.spec.ts` "should show profile banner based on COOP/COEP" is marked `test.fixme` (runtime profile timing).
   - `playwright.config.ts` starts its own dev server on port 5173 and stops with an error when the port is already in use (`reuseExistingServer: false`), for example by another project's dev server. Use `pnpm run e2e:local -- <spec>` instead: it starts its own server on a free port and points Playwright at it.

## 6. Commit and PR

- One bridge per commit: `refactor(<scope>): import X instead of the window global` (the subject must fit in 72 characters).
- The `.js` file count does not fall when a bridge is rewired; it falls in the later rewrite step.
- The body lists removed guards, remaining readers of the write and why they remain.
- One PR per bridge or per small family of sibling bridges (for example the six value parsers), each bridge in its own commit.
- Rewrites (`.js` to `.ts`, type annotations, lint cleanup) come after, in their own commits or PRs, with goldens still byte-identical.

## Skip the bridge or ask

- Removing the `window` write would break a reader outside `src/` that cannot be updated in the same change (inline HTML handler, console API users rely on).
- A reader has a fallback path for a missing global that could run in production, or importing the definer changes initialisation order (top-level side effects), or a cycle appears (`pnpm legacy:codemap --cycles`): preserve the behaviour through an adapter or skip the bridge. Ask the owner only when the fallback is product behaviour.
- A bridge has no reader: removing it needs an owner decision.
- The goldens go red and the diff cannot be explained, or the mutation probe stays green.
- The code is unused but substantive: leave it and ask.
- The change would touch two concerns at once.
