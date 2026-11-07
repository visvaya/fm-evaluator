# FM Evaluator Localization Source of Truth

Status: Active  
Scope: UI localization, file-language configuration, translation completeness, localization quality gaps  
Owner: Frontend localization  
Last Reviewed: 2026-09-29 (current-state and automation sections updated)  
Supersedes: older i18n migration notes that assumed `main.js` was still active  
See also: `docs/README.md`, `docs/quality-and-guardrails.md`, `src/i18n`, `public/i18n/messages`, `public/config/languages`

## 1. Purpose

This document defines how localization is organized in the current project and what quality gaps remain. It separates current reality from desired direction.

## 2. Two Different Language Concerns

The project has two distinct language systems:

### UI language

- user-facing application text,
- managed through `src/i18n` and message catalogs under `public/i18n/messages`,
- should cover controls, labels, dialogs, errors and user-facing status text.

### File language / export language

- source-language configuration for parsing Football Manager exports,
- managed through `public/config/languages`,
- used for header mapping, ambiguous-field handling and related import logic,
- not a replacement for UI translations.

These two concerns must stay separate in both code and documentation.

## 3. Current-State Reality

- The repo already has a real `src/i18n` system and public message catalogs.
- Historical documentation that still describes UI translations as living in `main.js` is outdated.
- `public/config/languages` remains important, but it is not the same thing as UI translations.
- Hard-coded user-facing strings in JSX are caught by `i18next/no-literal-string`; existing hits are frozen in `eslint-suppressions.json`. Strings in plain `.ts` and `.js` modules are not checked.

## 4. Active Ownership

| Concern                     | Owner path                                              | Notes                              |
| --------------------------- | ------------------------------------------------------- | ---------------------------------- |
| UI i18n runtime             | `src/i18n`                                              | Active implementation              |
| UI message catalogs         | `public/i18n/messages`                                  | Translation content                |
| File-language configs       | `public/config/languages`                               | Parsing and header-mapping support |
| Localization quality policy | `docs/language.md` and `docs/quality-and-guardrails.md` | Governance and gap tracking        |

## 5. Localization Quality Policy

### Required direction

- user-facing UI text should prefer i18n-backed strings,
- file-language parsing config should not be used as a substitute for UI translations,
- fallback behavior must stay explicit,
- missing translation coverage should be treated as a quality issue, not just a nice-to-have.

### Acceptable exceptions

Exceptions may exist temporarily for:

- transitional legacy-backed UI code,
- developer-only diagnostics,
- clearly non-user-facing internal labels.

Those exceptions should shrink over time rather than become normalized.

## 6. Known Gaps

The project should assume the following gaps are still plausible until proven otherwise:

- incomplete catalogs: `i18n-json/identical-keys` compares keys with `en.json` and reports one finding per catalog file, so a suppressed catalog in `eslint-suppressions.json` can hide more than one missing key,
- hardcoded UI strings in TS/JS files,
- mixed use of localized and non-localized modal/error strings,
- differences between message catalogs and the live UI surface,
- no automated detection of hardcoded strings outside JSX.

## 7. Enforcement Direction

Localization quality should be improved through a combination of documentation and automation.

### Desired automation

- detect missing keys relative to the base locale (exists: `i18n-json/identical-keys`),
- detect keys present in translated files but not in the base locale (exists: same rule),
- detect likely user-facing hardcoded strings in UI modules (open),
- validate file-language config structure separately from UI message completeness (exists: `scripts/validate-configs.cjs` via `pnpm run validate:all`, not in CI).

### What still requires human review

- whether a hardcoded string is truly user-facing,
- whether fallback behavior is acceptable for a given flow,
- whether locale coverage is good enough for a release,
- whether a parsing-language config change has UI impact.

## 8. Fallback Policy

### UI locale

- the base locale must remain stable and complete enough to act as fallback,
- untranslated strings should fall back predictably rather than fail silently.

### File-language configs

- file-language support should degrade clearly when a mapping is incomplete,
- missing header coverage should be surfaced as import quality debt, not hidden.

## 9. Review Questions

When changing localization-related behavior, check:

- is this UI language or file-language logic,
- where should the source of truth live,
- does the change introduce a hardcoded user-facing string,
- does the fallback behavior remain understandable,
- does the change require updates to message catalogs, parsing configs or both,
- does the quality tooling need to be extended to cover the new case.
