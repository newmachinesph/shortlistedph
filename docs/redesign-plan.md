# Frontend redesign plan — public + auth surface

> **Status (2026-07-25).** The design system is now **locked in `design.md`** and the
> visual direction shifted from "Workze grammar" to a hallmark-run **modern-minimal**
> system on the brand palette (same intent, sharper execution). Built so far: the 7 UI
> primitives + tokens (§1), the openings board data layer + leak guard + pages (§3), and
> the **homepage redesigned** as the exemplar. Remaining: the other marketing pages
> (`for-employers`, `for-talent`, `why-it-works`, `pricing`, `resume-template`, legal) and
> the admin "List publicly" control. Each page is now mechanical — `/hallmark redesign`
> reads `design.md` + the homepage exemplar. See `docs/HANDOFF.md` for the resume steps.

Scope agreed: public and auth pages only (~18 routes). Workze layout grammar, existing
brand palette. Talent/employer workspaces and admin are a later pass.

Reference layouts studied: `workze.framer.website` — `/jobs-list`, `/jobs-list-corporate`,
`/jobs-list-sidebar`, `/jobs-list-minimal`, `/landing-startup`, `/landing-corporate`,
`/landing-modern`.

What those templates actually give us:

- Sticky search bar + chip row (`All / Recent / Top-rated / Trending`) above a dense
  single-column list, not a card grid. Reads as a market, not a brochure.
- Left sidebar filter groups (sort, type) on the sidebar variant; the list itself is
  unchanged between variants — the filter chrome is the only difference.
- Listing row anatomy: title · date · location line · compensation · 1–2 sentence blurb ·
  category tags · a text CTA. No logos on the row.
- `Load more`, never numbered pagination.
- Landing: search-bar hero with a live count ("148+ positions"), a trending-listings strip
  reusing the same row component, a named testimonial with avatar, a stat/office block, one
  closing CTA band.

We take the grammar. We do not take the content model — theirs is a job board, ours is not.

---

## 0. The constraint that shapes everything

The site's stated promise: **job descriptions are hidden from candidates**, profiles are
snapshots, rates are standing. `docs/engine/shortlisted-matching-spec.md` is built around
that — hidden JDs are what stops resume tailoring, and tailoring is the failure mode the
whole facet-scoring design exists to prevent.

So the openings board is an **anonymized demand board, not an application funnel**:

| Shown | Hidden |
|---|---|
| Role family, public role title | Employer name, logo, website, any client identifier |
| Industry, client market/region (e.g. "US retail") | Full job description, responsibilities |
| Rate **band**, hours/week, overlap window | Exact budget, must-have tool list, screening questions |
| Posted date, "matching now / closed" state | Anything from `initialInstructions`, `schedulingUrl` |

No apply button anywhere on it. The only CTA is *upload your resume / keep your profile
current* — because on this platform being matched is automatic and applying is not a thing.
Each card carries a one-line explainer to that effect so the page cannot be mistaken for a
job board.

**Two leak risks, handled explicitly:**

1. *Client name in the title.* `JobDescription.title` is employer free text — "Support VA
   for Acme Apparel" is a plausible entry. So the board renders `publicTitle`, a separate
   admin-approved field, and lists **nothing** without it. No approval, no listing. Fails
   closed.
2. *Required-tool disclosure re-enables tailoring.* `mustHaves` / `niceToHaves` are never
   rendered. Rate is a coarse band ($5–10 / $10–15 / $15+), not the exact ceiling, so
   candidates cannot reverse-engineer a rate to squeeze under a filter — and
   `RateChange` + `rateLockedUntil` already impose a cooldown on anyone who tries.

---

## 1. Design system layer (built first, everything else consumes it)

`src/app/globals.css` — extend `@theme`, keep every existing colour token unchanged:

- Surface ladder: `--color-surface` (white card), `--color-surface-sunk` (paper), plus a
  dark band token derived from `--color-brand-dark` for the closing CTA / stat sections.
  Today the pages only alternate paper/white, which is why they read flat.
- Type scale as named steps (`--text-display`, `--text-h1…h3`, `--text-body`, `--text-meta`)
  using `clamp()`, so the current inline `text-[clamp(...)]` on the homepage becomes a token.
- Radius + shadow scale (`--radius-card`, `--radius-pill`, `--shadow-card`, `--shadow-lift`)
  — right now `rounded-2xl` / `rounded-3xl` / `rounded-xl` are picked ad hoc per file.
- `--space-section` for the vertical rhythm between bands.

`src/components/ui/` — new, small, no dependencies added:

| Component | Purpose |
|---|---|
| `section.tsx` | `<Section>` / `<SectionHeader>` — eyebrow + heading + lede, the band wrapper with tone variant (paper / white / brand) |
| `button.tsx` | The three button shapes already copy-pasted across pages (solid brand, ring, ghost-link-with-arrow) |
| `card.tsx` | Surface card + hover lift |
| `chip.tsx` | Filter chip + static tag pill |
| `stat.tsx` | Stat cell + stat strip (homepage `<dl>` generalized) |
| `avatar-cluster.tsx` | Overlapping avatar row + count, feeds off `Avatar` |
| `listing-row.tsx` | The Workze listing row — used by the board *and* the landing "live demand" strip |
| `empty-state.tsx` | Shared empty/zero-result state |

`Avatar` in `src/components/avatar.tsx` stays as-is — it already handles fallback, sizes,
and `next/image`. Cluster wraps it rather than replacing it.

---

## 2. Talent imagery (real avatars, randomized)

Avatars are already on the R2 CDN as `User.image`, `next.config.ts` already whitelists the
host, and the 779 legacy profiles were migrated there. So this is a query, not an upload
pipeline.

`src/lib/talent-showcase.ts` (server-only):

```
getShowcaseAvatars(limit) ->
  select u.image, p.headline, p.city, p.yearsExperience
  from "TalentProfile" p join "user" u on u.id = p."userId"
  where p."publishedAt" is not null
    and p.visibility = true
    and u.image is not null
    and u.status = 'active'
  order by random()
  limit $1
```

Cached with `revalidate = 3600`, same cadence as `getPublicStats()`, so "randomized" means
a fresh set each hour rather than per request — otherwise every render is a fresh DB hit and
the hero layout shifts on every navigation.

**Privacy — flagging this, it needs your call before it ships.** These are photographs of
real jobseekers. `visibility = true` is consent to be *matched*, which is not obviously
consent to appear as decoration on a marketing page. Plan therefore:

- Faces only. No name, no city, no headline attached to any avatar in a decorative cluster.
- Gated behind a new `AppSetting` key `showcase_avatars_enabled` (the settings
  infrastructure and admin toggle already exist for `maintenance_mode`) — one switch turns
  every marketing avatar into the initials chip if you want it off.
- Where a face appears *with* a headline (the "who's in the pool" strip), that comes from a
  separate opt-in flag on the profile, default off, surfaced in the talent workspace later.
  Until that flag exists, that strip renders initials chips + headline only.

If you'd rather not use real photos publicly at all, say so — the cluster falls back to
initials chips and nothing else in this plan changes.

---

## 3. Openings board

### Schema (Prisma, additive, all nullable or defaulted — no backfill required)

```prisma
model JobDescription {
  // ...existing
  publicTitle   String?   // admin-approved, sanitized. Null = not listed.
  roleFamily    String?   // small controlled taxonomy: ecommerce_ops, bookkeeping, ...
  industry      String?   // reuses the JD extraction taxonomy from the matching spec
  clientRegion  String?   // "US" | "AU" | "UK" | "EU" | "CA" — region, never company
  listedAt      DateTime?
  @@index([listedAt])
}
```

Migration is one `prisma migrate dev` adding four nullable columns and an index.

### Admin

The admin slate-review page already exists and is already the human checkpoint before a
slate goes out. Add a small "List publicly" block there: prefilled suggested `publicTitle`
(the employer title with any capitalized multi-word token flagged for review), role family
and industry selects, region select, and a publish toggle that stamps `listedAt`. One
approval step, in a screen an admin already opens.

### Public routes

- `/openings` — the board. Sticky search + chip row (`All · Matching now · Newest · By
  role`), a collapsible sidebar filter (role family, industry, region, engagement type) that
  becomes a bottom sheet under `md`, dense listing rows, `Load more`. Filters live in the
  URL as search params so a filtered board is shareable and server-rendered — no client
  state store.
- `/openings/[id]` — the anonymized detail view. Everything from the card, plus the honest
  bit: which facets this role weights, how many profiles cleared the hard filters, and a
  "you can't apply — here's what actually gets you matched" panel linking `/resume-template`
  and `/why-it-works`. This is where the engine docs earn their keep as a public asset.
- `openings/opengraph-image.tsx` — reuses `src/lib/og.tsx`.

### Data access

`src/lib/openings.ts` — one query file with `listOpenings(filters)` and `getOpening(id)`,
both returning a `PublicOpening` type that **only contains listable fields**. The type is
the guard: nothing renders an employer-derived field because no such field exists on the
shape the page receives. Same discipline `PublicStats` already uses.

Test: `src/lib/openings.test.ts` — asserts the mapper drops `employerId`, `mustHaves`,
`niceToHaves`, `screeningQuestions`, `initialInstructions`, `schedulingUrl`, and exact
budget, and that a JD with `publicTitle = null` never appears in `listOpenings`. That's the
one runnable check for this feature; it's the leak path.

---

## 4. Page-by-page

| Route | Work |
|---|---|
| `/` | Rebuilt on the new system. Hero keeps the current headline and the live `getPublicStats()` figures but gains an avatar cluster and a search-style entry to `/openings`. Adds a "live demand" strip of 5 listing rows. Employer/talent two-column band restructured into the Workze alternating layout. Closing CTA moves to the dark brand band. |
| `/openings`, `/openings/[id]` | New. Section 3. |
| `/for-employers` | Rebuilt: numbered process band, a sample-slate visual using real avatars + score bars from the scoring dims, pricing callout, FAQ. |
| `/for-talent` | Rebuilt: same grammar, plus a "what a good profile looks like" block lifted from `docs/engine/shortlisted-resume-template.md` and linking `/resume-template`. |
| `/why-it-works` | Rebuilt against `docs/engine/shortlisted-matching-spec.md` — the pipeline diagram (extract → facet → filter → rank → slate), the facet weight table, and the explanation template from §7 rendered as a real example card. This page is currently the weakest and the spec is the strongest source we have for it. |
| `/resume-template` | Rebuilt as a proper document page: sticky section nav, copyable skeleton block, do/don't table, straight from the resume-template doc. |
| `/pricing` | Rebuilt on the card/stat primitives. |
| `/start` | Form restyled on the new primitives; flow logic untouched. |
| `/onboarding` | `onboarding-wizard.tsx` is 28.8K — restyle the step chrome (progress, headers, field/button primitives) only. No rewrite of the wizard's state machine. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Shared split-panel auth layout: form left, brand panel right with an avatar cluster + a live stat. |
| `/terms`, `/privacy`, `/conduct` | Shared legal-doc layout: sticky TOC, readable measure. Copy untouched. |
| `public-nav`, `public-chrome` | Add "Open roles" to `NAV_LINKS` and the footer. Nav gains a scrolled-state border. Mobile disclosure panel unchanged — it already works. |

---

## 5. Order of work

1. Tokens + `src/components/ui/` primitives + `talent-showcase.ts`. Nothing user-visible.
2. Prisma migration + `openings.ts` + its test + admin listing controls.
3. `/openings` and `/openings/[id]`.
4. Homepage.
5. `/for-employers`, `/for-talent`, `/why-it-works`, `/resume-template`, `/pricing`.
6. Auth pages, legal pages, nav/footer.
7. `next build`, then a responsive + a11y pass at 320 / 768 / 1440 across the changed routes.

Each step builds clean before the next starts.

## 6. Explicitly not in this pass

Talent and employer workspaces, admin panel beyond the one listing block, and the per-profile
marketing opt-in flag (section 2).

The matching engine is a separate workstream — see `docs/engine/gap-analysis.md` and
`docs/engine/engine-plan.md`. Two touchpoints between the two plans:

- Engine phases 1a / 1b / 1d touch `src/lib` only and can run alongside this pass with no
  conflict. Engine phase 1c changes the employer brief form, so it sequences after this pass
  reaches `/start`.
- Engine phase 3 renames the `Dims.overlap` dimension to `capacity` (it never measured
  timezone overlap — gap analysis P2-2). That rename is UI-visible wherever a slate shows
  dimension labels, so whichever pass gets there second does the rename.

Verification for both plans is `docs/e2e-plan.md`. Journey J7 (every public route: 200, one
`h1`, no console errors, no overflow at 320/768/1440) is the regression net for this redesign
— build it before touching any page, and diff it before and after.
