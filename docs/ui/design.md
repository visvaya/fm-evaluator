# FM Evaluator UI and UX Design Source of Truth

Status: Active  
Scope: UI direction, interaction model, responsive behavior, visual system, accessibility baseline  
Owner: Product and frontend design  
Last Reviewed: 2026-09-29 (table model and mockups noted; the rest reviewed 2025-02-14)  
Supersedes: earlier design prompts and outdated neo-brutalist assumptions  
See also: `docs/ui/code.md`, `docs/README.md`, `docs/quality-and-guardrails.md`, mockups in `docs/ui/mockup/` (v1 to v5, generated images from 2026-05-11 and 2026-05-13; direction references, not specifications)

## 1. Product Positioning

FM Evaluator is a dense analytical application for Football Manager players working with large local datasets. The UI should feel fast, calm, legible and trustworthy. Data is the hero. Decoration is secondary.

The desired visual family is clean analytics, not neo-brutalism. The interface should feel closer to an internal research tool or serious financial/product analytics surface than to a playful landing page.

## 2. Core Design Principles

- Data-first over decoration-first.
- Light mode is the default and primary design target.
- Minimal friction for repeated expert use.
- Strong hierarchy and clarity over spectacle.
- Offline-first and self-hosted constraints are part of the design system, not implementation trivia.
- Accessibility and degraded states must be designed intentionally.

## 3. Self-Hosting Constraint

The design system must respect the project’s self-hosting and CSP policy.

That means:

- no Google Fonts,
- no external icon or asset CDNs,
- no visual direction that depends on third-party hosted assets,
- typography and visual assets must be satisfiable by self-hosted files already in the repo or intentionally added under the project’s asset policy.

Typography may still target Inter-like clarity, but the implementation assumption is self-hosted Inter or an equivalent local asset strategy.

## 4. Visual Direction

### Preferred aesthetic

- clean, precise, analytical,
- restrained surfaces,
- subtle borders and separators,
- numerically legible tables,
- minimal iconography,
- strong typographic rhythm.

### Anti-patterns to avoid

- thick black borders as a default motif,
- overly loud section contrast,
- aggressive badge and button saturation,
- visual noise that competes with core data,
- design that feels like an old legacy admin page or an over-styled concept shot.

## 5. Typography

### Direction

- Primary family: self-hosted Inter or equivalent neutral sans.
- Secondary/system fallback: `system-ui`, `-apple-system`, sans-serif.
- Numeric displays and tabular data should use tabular numerals where possible.

### Hierarchy

- headings should remain compact and purposeful,
- table cells should stay small but readable,
- labels should be visually distinct without overpowering the data,
- KPI values should be noticeably larger than surrounding copy without turning the page into a dashboard caricature.

### Suggested scale

| Element                   | Size        | Weight | Line height | Notes                                        |
| ------------------------- | ----------- | ------ | ----------- | -------------------------------------------- |
| H1 player or screen title | `1.75rem`   | 700    | 1.2         | For names and major analytical surfaces only |
| H2 section title          | `1.125rem`  | 600    | 1.3         | Compact section headers                      |
| H3 sub-section title      | `0.875rem`  | 600    | 1.4         | Dense cards and side panels                  |
| Body                      | `0.875rem`  | 400    | 1.5         | Default application copy                     |
| Body small                | `0.8125rem` | 400    | 1.5         | Secondary explanations                       |
| Table cell                | `0.8125rem` | 500    | 1.4         | Dense but legible                            |
| Caption or label          | `0.6875rem` | 600    | 1.3         | Usually uppercase with tracking              |
| Large KPI number          | `2rem`      | 700    | 1.0         | Used sparingly                               |

### Typographic rules

- Labels should usually use uppercase, compact spacing and muted color.
- Numeric surfaces should opt into `font-variant-numeric: tabular-nums`.
- Muted copy still needs review for contrast, especially on light surfaces.
- Avoid oversized display typography that steals attention from the actual data.

## 6. Color System

### Foundation

- light mode is the design baseline,
- surfaces should be subtle and stable,
- borders should separate rather than dominate,
- functional colors should communicate value or state clearly.

### Functional usage

- low or negative: red family,
- caution or mid: amber or orange family,
- good or high: green family,
- informational or accent: cool blue family,
- absent, disabled or missing: neutral gray family.

### Constraints

- muted text still needs adequate contrast,
- color cannot be the only carrier of meaning,
- heatmaps, bars and badges must remain readable for users who rely on structure more than hue.

### Suggested light-first tokens

| Token                | Value                   | Usage                                  |
| -------------------- | ----------------------- | -------------------------------------- |
| `--background`       | `oklch(0.985 0 0)`      | Page background                        |
| `--surface`          | `oklch(1 0 0)`          | Cards, panels, tables                  |
| `--surface-elevated` | `oklch(1 0 0)`          | Dropdowns, tooltips, elevated overlays |
| `--border`           | `oklch(0.905 0 0)`      | Primary borders                        |
| `--border-subtle`    | `oklch(0.95 0 0)`       | Row separators, soft dividers          |
| `--text-primary`     | `oklch(0.145 0 0)`      | Main text                              |
| `--text-secondary`   | `oklch(0.435 0 0)`      | Secondary copy                         |
| `--text-muted`       | `oklch(0.705 0 0)`      | Placeholder and weak emphasis          |
| `--accent`           | `oklch(0.58 0.233 260)` | Primary action and focus color         |
| `--accent-hover`     | `oklch(0.48 0.2 260)`   | Accent hover                           |
| `--positive`         | `oklch(0.68 0.16 160)`  | Good or high values                    |
| `--warning`          | `oklch(0.76 0.17 70)`   | Caution and middling values            |
| `--negative`         | `oklch(0.63 0.21 25)`   | Negative or weak values                |
| `--info`             | `oklch(0.62 0.19 285)`  | Neutral informational states           |

### Optional alternate dark-mode tokens

Dark mode is not the primary target, but if implemented later it should stay restrained rather than decorative.

| Token                | Value                   |
| -------------------- | ----------------------- |
| `--background`       | `oklch(0.14 0 0)`       |
| `--surface`          | `oklch(0.21 0.006 285)` |
| `--surface-elevated` | `oklch(0.27 0.006 285)` |
| `--border`           | `oklch(0.27 0.006 285)` |
| `--border-subtle`    | `oklch(0.24 0.006 285)` |
| `--text-primary`     | `oklch(0.985 0 0)`      |
| `--text-secondary`   | `oklch(0.71 0.008 285)` |
| `--text-muted`       | `oklch(0.44 0.008 285)` |

### Value legend

- low or poor values: red family
- middling values: amber or warning family
- good values: light green family
- excellent values: darker green family
- missing data: neutral muted family

Heatmaps, progress bars and score badges should reuse the same semantic legend rather than inventing a new color system per feature.

## 7. Spacing System

Base spacing should follow a `0.25rem` rhythm.

| Token        | Value     | Usage                   |
| ------------ | --------- | ----------------------- |
| `--space-1`  | `0.25rem` | Micro gaps              |
| `--space-2`  | `0.5rem`  | Tight internal spacing  |
| `--space-3`  | `0.75rem` | Compact control padding |
| `--space-4`  | `1rem`    | Default gaps            |
| `--space-6`  | `1.5rem`  | Card or panel padding   |
| `--space-8`  | `2rem`    | Section spacing         |
| `--space-12` | `3rem`    | Large page sections     |

Prefer consistent spacing tokens over one-off pixel values. Dense UI is acceptable, but cramped UI is not.

## 8. Information Architecture

### Primary desktop shape

- the main analytical table is the default anchor view,
- upload and setup should feel like an on-ramp into the table, not a separate mini-app,
- filters, settings and diagnostics should support the table rather than compete with it,
- player details should preserve table context via side panel or slideover patterns.

### Main UI zones

- top header: identity, high-value status, primary app-level controls,
- control strip: search, filters, presets, import-adjacent controls,
- data region: table, cards or visualization-backed data surface,
- detail region: player context, role scores, explanations and drill-down,
- diagnostics and degraded-state surfaces: clearly secondary but discoverable.

## 9. Layout and Responsive Model

### Desktop

- a large table is the primary view (target: virtualized; current React table is paginated through `usePlayerTable`, see `docs/ui/code.md`, virtualization posture),
- details open in a right-side panel or slideover without destroying table context,
- filters and controls should stay accessible without taking over the screen.
- minimum comfortable table width should assume horizontal scrolling before columns become unreadably compressed.
- sticky headers should remain stable during virtualization and scrolling.

### Tablet

- table can scroll horizontally,
- control density should compress gracefully,
- filters can collapse or reorganize without losing discoverability.

### Mobile

- card or list presentation can replace the full table where necessary,
- details should use a bottom sheet or full-screen detail view,
- the mobile design must still feel like the same product, not a different app,
- header height and control density must not crowd out the actual analytical content.
- overly dense charts should degrade to compact summaries, percentile bars or hidden-on-demand sections rather than unreadable mini-charts.

## 10. View Architecture

### Master-detail pattern

- Desktop details should open in a right-side slideover or persistent sidebar.
- Mobile details should use a bottom sheet or full-screen drill-down.
- Opening a player should preserve table context and current filters.
- Copying player names or IDs should be lightweight and not require opening full details.
- Closing a details surface should return focus to the originating row or trigger when the interaction started from keyboard navigation.

### Detail composition

The player-detail surface should usually contain:

1. Compact header with name, UID and key metadata.
2. KPI group for major scores such as `TOTAL`, `STAT` and `ATR`.
3. Supporting tables or metric groups for role fit, strengths, weaknesses and caveats.
4. Visualizations only where they add clear comparative understanding.

Preferred progressive-disclosure order for richer player details:

1. Player header and decision summary.
2. Why this player: top reasons or strongest signals.
3. Market context or comparative visualization.
4. Role requirements and attribute or stat breakdown.
5. Raw diagnostics and low-level details, collapsed by default unless actively needed.

## 11. Component Direction

### Header

- keep it informative but not tall,
- avoid stacking too many visual motifs,
- status indicators should be compact, not banner-like by default,
- import and diagnostics controls should remain understandable on first glance.

### Main table

- semantic table behavior on desktop remains the ideal,
- sticky headers should feel stable and clean,
- rows may use subtle hover and striping but should avoid heavy framing,
- numeric columns should align consistently,
- sorting, pinned columns and filter affordances should stay legible even in dense mode.

Suggested table rules:

- avoid vertical grid lines unless a specific dense comparison genuinely needs them,
- prefer subtle row separators with optional zebra striping,
- keep headers compact and uppercase-leaning rather than loud,
- align numeric values to the right,
- use truncation intentionally and expose full values where needed via detail affordances or tooltips.
- keep row height stable in dense virtualized mode rather than allowing unpredictable expansion,
- avoid heavy CSS filters, thick shadows or other row-level effects that fight virtualization performance.

### KPI cards

- large values should dominate, but the denominator or scale must stay visible,
- color should reinforce score meaning rather than decorate the card,
- use thin progress indications instead of bulky gauges,
- a KPI card should still be understandable without animation.

### Attribute and score tables

- percentage or percentile cells can use low-opacity background fills to make strong and weak areas scannable,
- use the same semantic color legend as the rest of the app,
- avoid heatmap saturation that obscures text legibility.

### Filters and controls

- primary actions should be clear but not oversized,
- secondary and ghost actions should remain lightweight,
- badges and pills should communicate state without turning into noise,
- filter state should remain obvious even when controls are collapsed,
- search and filtering should feel fast and forgiving, never modal by default.

### Details surface

- details should use a master-detail pattern,
- important metrics should be grouped and easy to compare,
- richer diagnostics should be expandable on demand rather than always visible,
- score explanations, role views and data caveats should be readable without feeling like debug output.

### Modals and overlays

- only use modals for true interruption or decision points,
- upload, LDC mapping, header mapping and settings flows should prioritize clarity over ornament,
- large modals need explicit scrolling behavior and stable close actions,
- destructive or lossy exits should be confirmable, not silent.

### Buttons, pills and icons

- primary buttons should be restrained solid-accent actions,
- secondary buttons should rely on border and subtle background change,
- ghost actions should stay compact and text-led,
- pills and badges should communicate state with shape, text and restrained color,
- iconography should stay outline-first and self-hosted,
- avoid square icon tiles as a default motif.

### Visualizations

- use charting only where it speeds understanding,
- every meaningful chart should have a readable fallback representation,
- chart styling must stay consistent with the restrained design system,
- beeswarm, LDC curve or role visuals should emphasize interpretation, not chart novelty.

### Data-viz palette guidance

- keep the general UI palette separate from the data-visualization palette,
- data visualizations should optimize for readability and comparison before brand expression,
- diverging scales should have a clear neutral midpoint,
- blue-to-orange is a strong default for diverging comparative visuals,
- sequential scales should prefer perceptually ordered palettes with stable contrast,
- important distinctions should use more than color alone where practical, such as markers, labels or annotations.

## 12. Interaction and Motion

- motion should be purposeful and brief,
- hover should aid orientation, not perform for the user,
- focus states must be obvious,
- selected and active states should be visibly distinct,
- loading states should be honest and calm,
- reduced-motion preferences must be respected.

Suggested defaults:

- color and background transitions: around `150ms ease-out`,
- dropdown or popover reveal: around `150ms`,
- modal or slideover entry: around `200ms` with restrained fade or slight scale,
- loading should prefer skeletons or calm spinners over flashy animated counters.

## 13. State, Feedback and Degraded UX

Important state classes that need intentional design:

- upload idle, drag-over and processing states,
- analysis in progress,
- worker-disabled or degraded mode,
- offline mode,
- missing data or low-confidence data,
- empty search/filter results,
- failed import or failed mapping flows,
- saved, restored or backup-related states.

These should use clear language, stable visual hierarchy and avoid panic-red noise unless the situation is truly an error.

## 14. Accessibility Baseline

This UI targets WCAG 2.2 AA as the practical baseline.

Important design implications:

- focus visibility is mandatory,
- text contrast must be reviewed intentionally,
- keyboard flows for table, dialogs and details views must be planned, not patched later,
- long-running work should expose status textually,
- chart meaning must remain available without relying on hover alone,
- degraded or offline states need explicit UX, not silent failure,
- touch, pointer and keyboard users should all be able to complete import and analysis flows.

## 15. Current Product-Specific Notes

- The app should eventually support optional user-provided local player-face graphics mapped by UID.
- The graphics path must remain optional and must always have graceful placeholder behavior.
- The product should be able to explain low-confidence mapping, missing league data and degraded analytics without dropping into raw debug language.
- OCR and heavy analytical flows should feel integrated into the product even when they run in background workers.

## 16. Known Design Debt

- parts of the current UI still reflect older visual assumptions and migration-era compromises,
- not all flows are yet equally coherent between React-driven and legacy-backed surfaces,
- some interactions remain shaped by technical debt rather than design intent,
- diagnostics, upload and analytical surfaces are not yet equally unified,
- documentation and implementation are still catching up with the shift away from neo-brutalist assumptions.

## 17. Design Review Questions

Every meaningful UI change should be evaluated against these questions:

- does it improve or reduce data legibility,
- does it align with light-first clean analytics direction,
- does it remain compatible with self-hosted asset constraints,
- does it improve accessibility or create friction,
- does it work on desktop, tablet and mobile,
- does it simplify the product experience for repeated analytical use,
- does it keep dense analytical work understandable when data quality or runtime capability is imperfect.
