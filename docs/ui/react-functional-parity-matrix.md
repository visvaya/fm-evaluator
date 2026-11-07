# React Functional Parity Matrix

Status: Active  
Scope: Legacy-to-React capability tracking for the current shell migration  
Last Reviewed: 2026-09-29

## Capability Matrix

| Area                     | Legacy status               | React status                       | Current target                                                                              |
| ------------------------ | --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Header actions           | Complete                    | Complete                           | Keep parity and avoid reintroducing top filter/global search                                |
| Left rail utility access | Present in concept/workflow | Complete                           | Keep files/LDC/diagnostics/settings/language entrypoints stable                             |
| Column search            | `Nazwisko` filter           | Complete                           | Maintain `Cmd/Ctrl + K` -> `Nazwisko` filter only                                           |
| Name cell affordances    | UID + copy                  | Complete                           | Keep copy icon, no preview icon                                                             |
| Pagination               | Full                        | Complete                           | Keep first/prev/jump/next/last + rows per page                                              |
| Player details           | Complete                    | Complete                           | Keep parity-oriented drawer sections                                                        |
| File management          | Complete                    | Complete                           | React modal shell with legacy backend actions                                               |
| Diagnostics              | Complete                    | React shell + TS/Zustand internals | `src/features/diagnostics/runtimeDiagnostics.ts` (`useDiagnosticsStore`)                    |
| Settings                 | Complete                    | React shell + TS settings model    | Opened by a DOM class toggle on `#settings-modal`; re-run goes through `legacyActionBridge` |
| LDC                      | Complete                    | React (`src/features/ldc/`)        | Remaining seam: singleton sync in `useLdcStore.ts`; `src/ui/ldcMissing.ts` is a shim        |
| Possession and OCR       | Complete                    | React shell + legacy internals     | `PossessionShell.tsx` plus legacy `src/ui/possessionModal.ts`                               |
| Column manager           | Complete                    | Legacy                             | `src/ui/columnManager.ts`                                                                   |
| Column filters           | Complete                    | React popover + legacy internals   | `ColumnFilterPopover.tsx` plus legacy `src/ui/filters.ts`                                   |
| Graphics                 | Optional/future             | Placeholder                        | Keep placeholder architecture at this stage                                                 |

## Notes

- This matrix tracks functional parity, not pixel parity.
- A capability is only considered migrated when the React surface can replace the old entrypoint for normal use.
- Intentional removals must be documented explicitly instead of silently disappearing during migration.
