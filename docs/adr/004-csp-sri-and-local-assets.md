# ADR-004: CSP, SRI and Local Asset Discipline

Status: Active  
Accepted: 2024-12 (as "SRI/CSP Security Policy")  
Last Reviewed: 2026-09-30  
See also: `security_headers.json`, `index.html`, `scripts/generate-sri.cjs`, ADR-001, `docs/quality-and-guardrails.md`

## Context

The app loads vendor libraries from `public/vendor/` (Tesseract, Cropper; on 2026-09-30 Fuse moved to the `fuse.js` npm package and crypto-js was replaced by `@noble/hashes` MD5, both bundled by Vite) and processes local, sensitive user data. It must resist supply-chain substitution of those files, script injection (XSS) and data exfiltration to other origins.

## Decision

- Runtime assets are self-hosted (ADR-001); remote fonts, icons or script bundles are rejected.
- Vendor scripts and styles in `index.html` carry `integrity` (SHA-384) and `crossorigin` attributes. `pnpm run sri:update` after any change in `public/vendor/` or the scripts in `index.html`; `pnpm run sri:check` verifies.
- CSP is part of the deployment contract, defined in `security_headers.json`.
- Target CSP (as accepted in 2024-12): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`, plus `Permissions-Policy: geolocation=(), microphone=(), camera=()`. `wasm-unsafe-eval` is for Tesseract WASM; `style-src-attr 'unsafe-inline'` was a temporary allowance for legacy inline styles; the `ws:` sources serve dev HMR only.

## Current state (strict CSP restored 2026-09-30)

- `security_headers.json` sends the target policy to preview and production, with two changes: the `ws:` sources moved to the dev-only relaxation, and `Permissions-Policy` plus `base-uri` and `frame-ancestors` are present. `X-Frame-Options: DENY` stays for older browsers.
- Dev-only relaxation: the Vite dev server (`server.headers` in `vite.config.ts`, `relaxCspForDevServer`) adds `'unsafe-inline'` to `script-src` and `style-src` and the HMR websocket origins to `connect-src`, because Vite serve injects the React refresh preamble and CSS as inline code. `vite preview` and production get none of it.
- The only eval found in the built app was the Zod 4 JIT probe (`Function('')`, caught, but reported as a violation); `src/lib/zodConfig.ts` sets `z.config({ jitless: true })` before any schema runs. Tesseract needs only `'wasm-unsafe-eval'`; its worker's `new Function("return this")` sits in a `try` with a fallback and did not fire in the checks. No inline `<script>` or handlers in `index.html`.
- Inline event handlers: the legacy filter popup (`src/ui/filterLegacyDom.ts`, listeners in `filterLegacyEvents.ts`) and the column list (`renderColumnList` in `src/ui/columnManager.ts`) use delegated listeners and `data-*` attributes instead of `on*=` attributes, which `script-src-attr 'none'` blocks; values in that markup are escaped (`src/utils/escapeHtmlAttribute.ts`). `src/ui/noInlineHandlers.test.ts` fails on any `on*="..."` attribute inside an HTML tag under `src/`.
- Verified 2026-09-30 on `vite preview` with a `report-uri` sink: import, LDC, opening the possession/OCR dialog and diagnostics, plus E2E `import-flow`, `ldc-and-offline` and `a11y`, produced zero violations; the parser worker and the service worker run.
- Resolved 2026-09-29: the production build no longer copies non-runtime files into `dist/`; `pnpm run check:dist` enforces it.

## Consequences

- Vendor updates are manual and require an SRI refresh; the vendor files enlarge the repository.
- New assets in `public/` or `assets/` are precached automatically: the build writes the service worker asset lists (`fm-sw-precache` plugin in `vite.config.ts`, logic in `scripts/lib/sw-precache.mjs`).
- A future SBOM would complete the supply-chain checklist (proposal, not scheduled).

## Why this remains a separate ADR

The decision is durable and cross-cutting: it governs how assets are introduced, how hosting is configured and why "easy" remote shortcuts stay forbidden.
