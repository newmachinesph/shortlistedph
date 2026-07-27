import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { refreshProfileEmbeddings } from "@/lib/profile-embedding";
import { syncProfileTools } from "@/lib/profile-tools";
import { rateLimit } from "@/lib/rate-limit";
import { INJECTION_FLAG, scanResumeText } from "@/lib/resume-guard";
import { isHttpUrl, normalizeSkill } from "@/lib/resume";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireRole("talent");
    const profile = await db.talentProfile.findUnique({
      where: { userId: user.id },
      include: {
        skills: true,
        engagements: true,
        rateChanges: { orderBy: { changedAt: "desc" }, take: 10 },
      },
    });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}

/**
 * These are rendered to employers as links, so only absolute http(s) survives.
 * Empty string is how the client says "clear this" — it stores as null.
 */
const webUrl = z
  .union([
    z.literal(""),
    z.string().trim().max(300).refine(isHttpUrl, "Links must start with http:// or https://"),
  ])
  .transform((v) => (v === "" ? null : v));

const optionalText = (max: number) =>
  z
    .union([z.literal(""), z.string().trim().max(max)])
    .transform((v) => (v === "" ? null : v))
    .optional();

const Patch = z.object({
  headline: z.string().max(160).optional(),
  summary: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  availability: z.enum(["open", "partial", "booked"]).optional(),
  committedHours: z.number().int().min(0).max(80).optional(),
  visibility: z.boolean().optional(),
  portfolioUrl: webUrl.optional(),
  linkedinUrl: webUrl.optional(),
  githubUrl: webUrl.optional(),
  education: optionalText(200),
  englishLevel: z.enum(["native", "fluent", "conversational", "basic"]).nullish(),
  tools: optionalText(400),
  certifications: optionalText(400),
  preferredOverlap: optionalText(80),
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  engagements: z
    .array(
      z.object({
        // Present for a row that already exists, so an edit is an UPDATE of
        // that row rather than a guess at which one the caller meant.
        id: z.string().max(40).optional(),
        role: z.string().max(120),
        company: z.string().max(120),
        span: z.string().max(60),
      }),
    )
    .max(12)
    .optional(),
});

/**
 * Every free-text field on this route lands on the same profile the resume
 * path guards. Only the resume path was guarded, so typing the instruction in
 * by hand — the cheapest attack there is — reached employers untouched and
 * never raised INJECTION_FLAG, which is what made that flag unreliable as an
 * admin review signal rather than merely incomplete.
 */
function injectedText(body: z.infer<typeof Patch>): boolean {
  return [
    body.headline,
    body.summary,
    body.tools,
    body.certifications,
    ...(body.engagements ?? []).flatMap((e) => [e.role, e.company]),
  ].some((t) => typeof t === "string" && scanResumeText(t));
}

/** Only these change what gets embedded — see profileEmbedText + buildFacetTexts. */
const EMBEDDED_SCALARS = [
  "headline",
  "summary",
  "city",
  "yearsExperience",
  "availability",
  "committedHours",
  "education",
  "englishLevel",
  "tools",
  "certifications",
  "preferredOverlap",
] as const;

/** Rate is deliberately NOT editable here — see /api/talent/rate for the 30-day lock. */
export async function PATCH(req: Request) {
  try {
    const user = await requireRole("talent");
    // Every save of a published profile fires four embedding calls, so an
    // autosave loop or a stuck client is a real bill, not just noise.
    rateLimit("profileWrite", user.id);
    const profile = await requireTalentProfile(user.id);
    const body = await parseBody(req, Patch);

    // Rejected rather than scrubbed: the resume path strips because a candidate
    // cannot re-edit a document we parsed for them, but here the author is
    // sitting in the form and can fix the line. The flag is recorded either
    // way — the attempt is the thing admin review needs to see.
    if (injectedText(body)) {
      await db.talentProfile.update({
        where: { id: profile.id },
        data: { flags: { set: [...new Set([...profile.flags, INJECTION_FLAG])] } },
      });
      throw new HttpError(422, "That text reads as an instruction to our system — please rewrite it");
    }

    const { skills, engagements, ...scalars } = body;

    // committedHours is now a DERIVED total — the talent's own figure plus every
    // engagement this platform has confirmed — so what arrives here is the
    // self-reported part. It is written to both: to selfCommittedHours as the
    // baseline that survives every recompute, and to committedHours so the form
    // reflects the answer immediately. syncCommittedHours puts the confirmed
    // hours back on top the next time it runs.
    const selfHours = scalars.committedHours;

    // lastEditedAt is the anti-tailoring clock, and re-embedding is four API
    // calls. Neither belongs to an edit that changes no embedded text — a bare
    // `{visibility:false}` was resetting a talent's stability figure and
    // spending four embeddings to write back the same vectors.
    const touchesEmbeddedText =
      skills !== undefined ||
      engagements !== undefined ||
      EMBEDDED_SCALARS.some((k) => scalars[k] !== undefined);

    await db.$transaction(async (tx) => {
      if (skills) {
        // Diff rather than replace: a wipe-and-recreate would silently drop the
        // confirmed flag off every surviving skill, and confirmation is evidence.
        const kept = new Map(skills.map((name) => [normalizeSkill(name), name]));
        const current = await tx.skill.findMany({ where: { profileId: profile.id } });
        const removed = current.filter(
          (s) => !kept.has(s.normalizedName) && !s.confirmed,
        );
        if (removed.length) {
          await tx.skill.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
        }
        const have = new Set(current.map((s) => s.normalizedName));
        const added = [...kept].filter(([norm]) => norm && !have.has(norm));
        if (added.length) {
          await tx.skill.createMany({
            data: added.map(([normalizedName, name]) => ({
              profileId: profile.id,
              name,
              normalizedName,
            })),
          });
        }
      }
      if (engagements) {
        // Identity is the row id, not `role|company`. That key discarded every
        // span correction (same key in and out, so nothing was written while
        // the UI said "saved") and collapsed two real engagements at the same
        // company into one on the next save.
        //
        // Clients that don't round-trip ids (the onboarding wizard) fall back
        // to matching the whole triple, so resending an unchanged list still
        // matches its rows instead of duplicating them.
        const triple = (e: { role: string; company: string; span: string }) =>
          `${normalizeSkill(e.role)}|${normalizeSkill(e.company)}|${normalizeSkill(e.span)}`;
        const current = await tx.engagement.findMany({ where: { profileId: profile.id } });
        const byId = new Map(current.map((e) => [e.id, e]));
        const claimed = new Set<string>();
        const created: { role: string; company: string; span: string }[] = [];

        for (const e of engagements) {
          const row = e.id ? byId.get(e.id) : undefined;
          if (row && !claimed.has(row.id)) {
            claimed.add(row.id);
            // A confirmed engagement is mutual evidence — its text is not the
            // talent's alone to rewrite, so the claim holds the row but
            // changes nothing.
            if (row.outcome !== "confirmed") {
              await tx.engagement.update({
                where: { id: row.id },
                data: { role: e.role, company: e.company, span: e.span },
              });
            }
            continue;
          }
          const match = current.find((c) => !claimed.has(c.id) && triple(c) === triple(e));
          if (match) claimed.add(match.id);
          else created.push({ role: e.role, company: e.company, span: e.span });
        }

        // Same rule on the way out: confirmed rows survive a save that omits them.
        const removed = current.filter((e) => !claimed.has(e.id) && e.outcome !== "confirmed");
        if (removed.length) {
          await tx.engagement.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } });
        }
        if (created.length) {
          await tx.engagement.createMany({
            data: created.map((e) => ({ ...e, profileId: profile.id })),
          });
        }
      }
      await tx.talentProfile.update({
        where: { id: profile.id },
        data: {
          ...scalars,
          ...(selfHours !== undefined ? { selfCommittedHours: selfHours } : {}),
          // Answering the availability question IS confirming it. The dedicated
          // route always stamped this; this one did not, so a profile published
          // through the wizard was born stale and got nudged about something it
          // had just been told.
          ...(scalars.availability ? { availabilityConfirmedAt: new Date() } : {}),
          ...(touchesEmbeddedText ? { lastEditedAt: new Date() } : {}),
        },
      });
    });

    // A published profile's vectors must track its text, or matching ranks a
    // person the pool no longer contains. Best-effort: an embed hiccup must
    // not lose the save itself — the stale vector self-heals on the next save
    // or publish.
    const { publishedAt } = await db.talentProfile.findUniqueOrThrow({
      where: { id: profile.id },
      select: { publishedAt: true },
    });
    if (publishedAt && touchesEmbeddedText) {
      try {
        await refreshProfileEmbeddings(profile.id);
      } catch (e) {
        console.error("[talent/profile] re-embed after edit failed", e);
      }
    }

    // Canonical tools are derived from skills + the tools free text, so any
    // edit that touches either has to re-derive them. Without this the table
    // only ever reflected the one-off backfill (engine-plan 2a).
    if (skills || scalars.tools !== undefined) {
      try {
        await syncProfileTools(profile.id);
      } catch (e) {
        console.error("[talent/profile] tool sync after edit failed", e);
      }
    }

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}
