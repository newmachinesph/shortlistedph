# Design — shortlisted.ph

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow. Where this file and Hallmark's per-build references
conflict, this file wins. Pages that drift from it are slop.

The palette and fonts here are **brand-locked** — they predate this system and
are not up for a theme swap. Hallmark's job is structure, rhythm, and component
voice on top of them, not a re-colour.

## Genre

modern-minimal (Stripe / Linear / Vercel school). Restraint over decoration;
hierarchy through scale and space, not borders and boxes.

## Macrostructure family

Pages within a family share the family's shape; they vary only in component
archetypes and section rhythm.

- **Marketing pages** (`/`, `/for-employers`, `/for-talent`, `/why-it-works`,
  `/pricing`, `/openings`, `/start`): Marquee-Hero, Stat-Led, or Long-Document —
  pick per page's job. `/` is Marquee-Hero; `/why-it-works` is Long-Document;
  `/openings` is a directory/list shape. They vary on macrostructure but share
  every token, the CTA voice, and the section-heading rhythm below.
- **App pages** (`/talent/*`, `/employer/*`, `/admin/*`): Workbench. Function
  carries the page. No enrichment, no hero.
- **Content pages** (`/terms`, `/privacy`, `/conduct`, `/resume-template`):
  Long-Document. Sticky TOC, readable measure (~68ch), typography only.

## Theme

Brand-locked. Working tokens live in `src/app/globals.css` as hex (the app's
source of truth); OKLCH equivalents are in `## Exports` for portability. Never
introduce a colour that isn't one of these.

- `--color-paper`      `#fafcfd`  page background
- `--color-surface`    `#ffffff`  raised card
- `--color-surface-sunk` `#f2f6f3`  recessed / hover row
- `--color-band`       `#1b3a28`  dark section (CTA / stat bands)
- `--color-ink`        `#17201b`  primary text
- `--color-ink-soft`   `#51605a`  secondary text
- `--color-ink-faint`  `#67766e`  meta / labels (AA on paper)
- `--color-line`       `#e3e9e5`  hairline rules, borders
- `--color-brand`      `#306644`  primary accent (green)
- `--color-brand-dark` `#245034`  hover / pressed
- `--color-brand-soft` `#eaf2ed`  accent tint fields
- `--color-ember`      `#a4491a`  secondary accent (eyebrows, talent-side)
- `--color-ember-soft` `#f9ece3`  ember tint

**Accent discipline:** green is the primary accent, ember the secondary. Between
them, chromatic accent covers ≤ 5 % of any viewport. Ember is for eyebrows and
the talent side of the two-audience story; green is everything else. Never ember
for body text (fails AA on its own soft tint below 14px).

## Typography

- **Display:** Space Grotesk, weight 600, style **normal** (roman — no italic
  headers, ever). Var: `--font-grotesk` / Tailwind `font-display`.
- **Body:** Inter, weight 400/500. Var: `--font-inter` / `font-sans`.
- **Mono:** none — this is not a terminal aesthetic.
- **Display tracking:** `-0.02em` (`tracking-tight`).
- **Type scale:** the named `--text-*` tokens in globals.css. Display uses
  `--text-display`; page H1 `--text-h1`; section H2 `--text-h2`. All fluid via
  `clamp()`. Hero headlines ≤ 7 words / ≤ 50 chars.

## Spacing

4-point named scale. Section rhythm is `--space-section` (a fluid clamp) between
bands. Pages use named tokens, never raw values.

## Motion

**Motion-cut project** — no motion library installed, and none is to be added.

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`; browser default `ease`
  is banned.
- Reveal pattern: **fade-only**, or none. No scroll-driven slide-ins, no
  parallax, no stagger. Most sections have no reveal at all.
- Transitions: `transform` and `opacity` only, ≤ 220ms. Never animate layout
  (width/height/top/left/margin).
- Reduced-motion: `prefers-reduced-motion: reduce` collapses any reveal to a
  ≤ 150ms opacity crossfade.
- Focus ring shows **instantly** — never animated.

## Microinteractions stance

- Silent success over celebratory toasts.
- Optimistic update + Undo over confirmation dialogs where it fits.
- Hover tooltips delay 800ms; focus tooltips 0ms.
- Hover-lift on interactive cards/rows only (`--shadow-lift`), never on static
  panels.

## CTA voice

Matches `src/components/ui/button.tsx` — do not reinvent per page.

- **Primary:** solid `--color-brand` fill, white text, `--radius-card` (1rem),
  `px-6 py-3.5`, soft brand-tinted shadow, hover → `--color-brand-dark`. Copy is
  an imperative verb phrase ("Get your shortlist", "Upload your resume").
- **Secondary:** ring outline (`ring-1 ring-brand/30`), brand text, same radius
  and padding, hover → `--color-brand-soft` fill.
- **Tertiary:** ghost text link, brand colour, trailing `ArrowRight`, underline
  on hover.
- Focus-visible: 2px brand ring at ≥ 3:1, `ring-offset-2`.

## Per-page allowances

- Marketing pages MAY use Tier-A CSS-art / Tier-B SVG enrichment and real talent
  photos (via `getShowcaseAvatars` + `AvatarCluster`, faces only).
- App pages MUST NOT use enrichment.
- Content pages: typography only.

## What pages MUST share

- The wordmark (`src/components/logo.tsx`) and its placement in `PublicNav`.
- The green/ember accent and its ≤ 5 % placement.
- Space Grotesk display + Inter body.
- The CTA voice (the three Button variants above).
- The section-heading rhythm: eyebrow (uppercase, tracked, `--text-meta`, brand
  or ember) → display H2 → optional lede. Provided by `SectionHeader` in
  `src/components/ui/section.tsx`. **Eyebrow stacks above the heading, same
  column — never the tag-left / heading-right two-column pattern.**

## What pages MAY differ on

- Macrostructure within the marketing family (Marquee-Hero vs Stat-Led vs
  Long-Document) — but the type, colour, and CTA voice stay constant.
- Hero archetype within the family's allowance.
- Enrichment — marketing pages only, Tier-A / Tier-B only.

## Primitives

The system is implemented as tokens in `src/app/globals.css` and seven
components in `src/components/ui/`: `Button`/`ButtonLink`, `Card`, `Section`/
`SectionHeader`, `StatStrip`, `Chip`/`Tag`, `ListingRow`, `EmptyState`. Page
redesigns compose these — they do not hand-roll a card or a button.

## Exports

Drop-in formats for re-using this design system. OKLCH values are conversions
of the brand hexes above (approximate; the hex tokens remain canonical).

### tokens.css
```css
:root {
  --color-paper:        oklch(99.1% 0.002 220);
  --color-surface:      oklch(100%  0     0);
  --color-surface-sunk: oklch(96.5% 0.006 158);
  --color-band:         oklch(31%   0.055 158);
  --color-ink:          oklch(23.5% 0.013 158);
  --color-ink-soft:     oklch(45%   0.012 165);
  --color-ink-faint:    oklch(53%   0.012 155);
  --color-line:         oklch(92.5% 0.006 158);
  --color-brand:        oklch(48.5% 0.095 158);
  --color-brand-dark:   oklch(41%   0.090 158);
  --color-brand-soft:   oklch(95%   0.02  158);
  --color-ember:        oklch(52.5% 0.13  51);
  --color-ember-soft:   oklch(94%   0.03  51);
  --color-focus:        oklch(48.5% 0.095 158);

  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body:    "Inter", system-ui, sans-serif;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 220ms;
  --radius-card: 16px; --radius-pill: 999px; --radius-lg: 24px;
}
```

### Tailwind v4 `@theme`
```css
@theme {
  --color-paper:  oklch(99.1% 0.002 220);
  --color-ink:    oklch(23.5% 0.013 158);
  --color-brand:  oklch(48.5% 0.095 158);
  --color-ember:  oklch(52.5% 0.13 51);
  --font-display: "Space Grotesk", sans-serif;
  --font-sans:    "Inter", sans-serif;
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`
```json
{
  "color": {
    "paper":  { "$value": "oklch(99.1% 0.002 220)", "$type": "color" },
    "ink":    { "$value": "oklch(23.5% 0.013 158)", "$type": "color" },
    "brand":  { "$value": "oklch(48.5% 0.095 158)", "$type": "color" },
    "ember":  { "$value": "oklch(52.5% 0.13 51)",   "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk", "$type": "fontFamily" },
    "body":    { "$value": "Inter",         "$type": "fontFamily" }
  }
}
```

### shadcn/ui CSS variables
```css
:root {
  --background:         99.1% 0.002 220;
  --foreground:         23.5% 0.013 158;
  --primary:            48.5% 0.095 158;
  --primary-foreground: 100%  0     0;
  --muted:              96.5% 0.006 158;
  --muted-foreground:   53%   0.012 155;
  --border:             92.5% 0.006 158;
  --input:              92.5% 0.006 158;
  --ring:               48.5% 0.095 158;
  --radius:             16px;
}
```
