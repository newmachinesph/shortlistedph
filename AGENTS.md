<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — shortlisted.ph

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma + Postgres (Neon, pgvector) ·
BetterAuth · OpenAI (extraction + embeddings) · PayPal + PayMongo · R2 · Mailpit/Resend.

## Loadouts (equip what applies)
@~/.claude/rules/loadout/profiles/web.md
<!-- core packs (common/karpathy/git/security/windows) are always on via global CLAUDE.md -->

## Golden rule
Pull current docs via **Context7** for the exact installed version before coding. Don't trust training memory.

## Memory (read at session start, update at session end)
- `PROJECT.md`  — current status
- `DECISIONS.md` — why we chose things
- `MISTAKES.md`  — pitfalls to not repeat
- `docs/system-audit.md` — full audit, roadmap source of truth (P0→P5)
- `CONTRACT.md`  — plan for a high-risk change; create before, delete after verify
