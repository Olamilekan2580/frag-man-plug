# VEGArance Design System — v3 (Phase A)

Single source of truth: `design-system.css`. Every page loads it **last** so
its tokens win over the legacy sheets (`style.css`, `vegarance.css`,
`vegarance-pages.css`, `platform.css`). Legacy sheets are kept — they still
own page layout — but new work must use the tokens and components below, and
must not invent one-off colours, radii, or spacing.

## Tokens

All tokens live on `:root` with a `--ds-` prefix.

| Group | Tokens | Notes |
|---|---|---|
| Brand | `--ds-ink`, `--ds-ink-deep`, `--ds-ink-soft`, `--ds-ivory`, `--ds-ivory-2`, `--ds-paper`, `--ds-gold`, `--ds-gold-deep`, `--ds-gold-soft`, `--ds-text`, `--ds-muted`, `--ds-line`, `--ds-line-strong` | Codifies the v2 ink / ivory / champagne-gold palette. Same values as v2 — restyle is consolidation, not a rebrand. |
| Semantic | `--ds-success` / `-bg`, `--ds-warning` / `-bg`, `--ds-danger` / `-bg`, `--ds-info` / `-bg` | Status only. Never use for marketing urgency. |
| Type | `--ds-font-sans`, `--ds-font-serif`, `--ds-text-xs/sm/base/lg/xl/2xl`, `--ds-leading` | Body text is sans; display headings are serif (v2 rule, kept). |
| Spacing | `--ds-space-1/2/3/4/6/8/12/16` | 4px base. No magic margins. |
| Radii | `--ds-radius-0/sm/md/lg/pill` | Brand is mostly square (`0`); radius is reserved for pills and small controls. |
| Shadow / focus | `--ds-shadow-sm/md`, `--ds-focus-ring` | Focus ring is gold, 3px, always visible on keyboard focus. |

## Components (all `.ds-` prefixed)

- **Buttons:** `.ds-btn` (primary, ink), `.ds-btn-ghost`, `.ds-btn-danger`,
  `.ds-btn-sm`, `.ds-btn-lg`. Minimum touch target 44px.
- **Forms:** `.ds-field` + `.ds-label` + `.ds-input` / `.ds-select` /
  `.ds-textarea` + `.ds-hint` + `.ds-error`. Invalid fields get
  `aria-invalid="true"` and a danger border.
- **Surfaces:** `.ds-card`, `.ds-grid-2`, `.ds-grid-3` (collapse to 1 column
  under 820px), `.ds-stat` + `.ds-stat-label`.
- **Badges:** `.ds-badge` + `-success` / `-warning` / `-danger` / `-info`.
  Status words only — never "Only 2 left" or fake urgency.
- **Alerts:** `.ds-alert` + `-success` / `-warning` / `-danger` (default is
  info). Use for honest state: not configured, failed check, next step.
- **Empty states:** `.ds-empty`. Every empty state names what is empty and
  gives the exact next action. Never render a fake product, review, or
  counter to fill space.
- **Tables:** `.ds-table`.
- **Stepper + progress:** `.ds-stepper` (ordered list; `aria-current="step"`
  on the current step, `.ds-done` on completed steps, `.ds-locked` on
  blocked steps) and `.ds-progress` (bar with inner `div` width %).
- **Skeleton:** `.ds-skeleton` / `-img` / `-line`. Loading shimmer only;
  animation is disabled under `prefers-reduced-motion`.
- **Toast:** `.ds-toast` with `role="status"` / `aria-live="polite"`,
  `hidden` when empty.

## Accessibility rules (enforced, not aspirational)

1. `:focus-visible` gets a 3px gold outline + ring on every page. Never
   remove outlines.
2. Keyboard navigation must reach every interactive element in DOM order.
   Dialogs and menus expose `aria-label` / `aria-expanded` /
   `aria-controls` (existing `vegarance-pages.js` chrome already does).
3. `prefers-reduced-motion: reduce` disables all animation and smooth
   scrolling (global rule in the design system).
4. Skip links: every page has a skip link to its main content
   (`.ds-skip-link` on dashboard pages, `.skip-link` on storefront pages).
5. Live regions (`role="status"`, `aria-live="polite"`) carry async results
   (onboarding status, order status, search results) — never silent updates.
6. Colour is never the only signal: status badges pair colour with text,
   stepper steps pair colour with ✓ / number / "locked" wording.

## Scopes

- `.ds-app` (merchant dashboard `platform.html`, merchant storefront
  `merchant-shop.html`, merchant order page `merchant-order.html`,
  `onboarding.html`): panel / input / button / checkout-step rules that
  apply the design system to the dashboard without touching the
  owner-store stylesheets.
- Storefront bridge: `.vega-empty`, `.vega-toast`, `.vega-sk-img`,
  `.vega-filters`, `.vega-toolbar`, `.vega-search-row` are restyled onto
  design-system tokens so all 16 v2 storefront pages inherit the system.

## What was deliberately NOT changed in Phase A

- Page layouts (`style.css`, `vegarance.css`, `layout-fixes.css`,
  `refinement.css`, `luxury.css`, `commerce.css`) — kept as-is; the design
  system is a token + component layer on top, not a layout rewrite.
- The owner-store admin (`admin.html`) gets tokens + focus rules only.
- No new brand, logo, or colour direction. A rebrand is a separate
  decision for a later phase.
