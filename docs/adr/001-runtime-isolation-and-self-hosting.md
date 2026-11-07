# ADR-001: Runtime Isolation and Self-Hosting

Status: Active  
Accepted: 2024-12 (as "COOP/COEP Strategy"), merged with the self-hosting rule 2025-02  
Last Reviewed: 2026-09-29  
See also: `security_headers.json`, `vite.config.ts`, `src/runtime.ts`, `src/features/diagnostics/runtimeDiagnostics.ts`, ADR-004, `docs/quality-and-guardrails.md`

## Context

FM Evaluator keeps imported data local and relies on browser features that need `crossOriginIsolated === true`: `SharedArrayBuffer` and `Atomics` for multi-threaded OCR (Tesseract) and a possible future Pyodide layer, and high-resolution timers. Browsers enable these only when the page is served with COOP and COEP headers.

## Decision

- Security headers are part of the runtime contract. Single source of truth: `security_headers.json`, used by `vite.config.ts` (dev and preview).
- COOP `same-origin`, COEP `require-corp`, CORP `same-origin`.
- No external CDNs: fonts, icons, scripts, worker assets and WASM are served from the app's own origin.
- Degraded profiles are explicit fallbacks, detected at runtime and shown to the user, never silent assumptions: `full`, `lite` (low-power hints) and `ts-only` (no isolation or no IndexedDB).

## Alternatives considered

- `COEP: credentialless`: loads cross-origin resources without CORP, but gives weaker isolation, was unsupported in older Safari, and is unnecessary because every asset is self-hosted. Rejected.

## Consequences

- The production server must send the headers from `security_headers.json` itself; Vite sends them only in dev and preview. A static host that cannot set headers (for example GitHub Pages) runs the app in the `ts-only` profile. Whatever the host, its configuration must send the headers from `security_headers.json`.
- Every new dependency must be self-hostable and must work under COEP `require-corp`.

## Why this remains a separate ADR

The decision is durable and cross-cutting: it constrains hosting, assets, workers, dependency choices and documentation, and explains why several convenient shortcuts (CDNs, static hosting without headers) are rejected.
