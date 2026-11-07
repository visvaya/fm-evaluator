# ADR Index

Status: Active  
Scope: Minimal ADR registry  
Last Reviewed: 2026-11-03  
See also: `docs/README.md`

## ADR policy

This project keeps only a minimal ADR set. Separate ADR files exist only for durable, cross-cutting architectural decisions whose rationale should survive changes in implementation details, rules or plans.

Operational guidance, current architecture shape and migration planning belong in:

- `docs/README.md`
- `docs/ui/code.md`
- `docs/ui/design.md`
- `docs/quality-and-guardrails.md`
- `docs/language.md`

## Active ADRs

| ADR                                         | Status | Purpose                                                                                        |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `001-runtime-isolation-and-self-hosting.md` | Active | Runtime isolation (COOP/COEP), self-hosting, degraded profiles, production hosting requirement |
| `004-csp-sri-and-local-assets.md`           | Active | SRI, strict CSP (restored 2026-09-30) and local-asset discipline                               |

## Removed ADRs

The 2024-12 worker-model (002) and Dexie-storage (003) ADRs were removed as active ADRs because their content lives in `docs/ui/code.md`.
