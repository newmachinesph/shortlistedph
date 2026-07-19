# shortlisted.ph

Reverse-hiring platform for Philippine remote talent. Employers post **hidden job descriptions**; the matching engine ranks standing talent profiles and delivers a **shortlist**. Talent never applies, never tailors, never pays.

**Current state: frontend prototype.** All data is static and fictional (`src/data/`). No backend, no auth, no persistence. See `BACKEND.md` for the implementation plan.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

## Model in one paragraph

Sourcing only — the platform witnesses (agreements, outcome confirmations) but never touches salaries and never stores identity documents. Employers see slates free with names blurred; $49 unlocks names + connections. Candidates consent before contact. Anti-gaming: hidden JDs (nothing to tailor to), snapshot profiles (frozen at post time), standing rates with visible history, provenance-tagged claims.

## Route map

| Area | Routes |
|---|---|
| Public | `/` `/pricing` `/conduct` `/terms` `/privacy` |
| Auth | `/login` `/register` `/forgot-password` `/reset-password` `/onboarding` (talent, incl. expectation gate) |
| Employer | `/employer` + `briefs` `briefs/new` `briefs/[id]` (slate; locked-preview vs unlocked) `candidates/[id]` `connections` `agreements` `ratings` `messages` `support` `legal` `notifications` `billing` `profile` |
| Talent | `/talent` + `services` (rate card + market percentile) `connections` (consent flow) `agreements` `ratings` `messages` `support` `legal` `notifications` `payouts` `profile` |
| Admin | `/admin` + `reports` `users` `slates` (no auth gate yet — prototype) |

## Design system

Tailwind v4, CSS-first tokens in `src/app/globals.css`, palette derived from `public/shortlisted-logo.svg`:
`brand` #306644 (green) · `ember` #c96027 (orange) · `paper` / `ink` / `line` neutrals. Display font Space Grotesk (`font-display`), body Inter — all sans-serif. Cards: `rounded-2xl border border-line bg-white`. Avatars are rounded **squares** (lg/xl/2xl by size), never circles.

Known gotcha: never put loose text nodes + interpolations directly inside a `flex` container — wrap the sentence in one `<span>` (each node becomes a flex item otherwise).

## Demo storyline

One consistent narrative across all screens: **Harbor Dental Group** (Austin, TX) posted a Medical VA job → slate of 5 → connected with **Kristine Bautista** (Davao) → interviewed Jul 17 2026 → agreement e-signed Jul 18, starts Aug 3. Second brief (Senior React) shows the locked-preview state; third (CX lead) shows matching-in-progress.

## Where the backend plugs in

All mock data flows from `src/data/candidates.ts` and `src/data/briefs.ts`; page-local arrays cover secondary screens. Swap points and API contracts are specified in `BACKEND.md`.
