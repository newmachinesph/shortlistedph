import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { refreshProfileEmbeddings } from "@/lib/profile-embedding";
import { syncProfileTools } from "@/lib/profile-tools";
import { rateLimit } from "@/lib/rate-limit";
import { getObjectBuffer } from "@/lib/r2";
import { educationSummary, extractText, normalizeSkill, parseResume } from "@/lib/resume";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

const Body = z.object({ key: z.string().min(1) });

/**
 * A resume states hours AVAILABLE; the column stores hours already COMMITTED,
 * and both the hours_short filter and scoreOverlap read 40 minus it. Dropping
 * the parsed value left every imported profile at 0 committed — reading as
 * fully free no matter what the resume said.
 */
const committedFromAvailable = (hoursAvailable: number | null): number | null =>
  hoursAvailable == null ? null : Math.min(80, Math.max(0, 40 - hoursAvailable));

/** Same shape the merge dedupes on, used for both stored and parsed rows. */
const engagementKey = (e: { role: string; company: string }) =>
  `${normalizeSkill(e.role)}|${normalizeSkill(e.company)}`;

/**
 * Reads the uploaded resume, extracts a draft profile, saves it UNPUBLISHED.
 *
 * Skills and engagements MERGE, they do not replace. A migrated profile can
 * carry years of imported history plus outcome-confirmed evidence, and a resume
 * is only ever a guess about the same person — re-uploading one must never be
 * able to delete a row the user did not ask to remove.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("talent");
    // An LLM extraction over a whole resume, repeatable at will. The bucket
    // and the import were both here; the call itself had gone missing, so the
    // limit existed only on paper.
    rateLimit("resumeParse", user.id);
    const profile = await requireTalentProfile(user.id);
    const { key } = await parseBody(req, Body);

    // Ownership check — the key must live under this profile's prefix.
    if (!key.startsWith(`resumes/${profile.id}/`)) {
      throw new HttpError(403, "That file does not belong to this profile");
    }

    const buf = await getObjectBuffer(key);
    const text = await extractText(buf, key);
    const { profile: parsed, flags } = await parseResume(text);

    const [existingSkills, existingEngagements] = await Promise.all([
      db.skill.findMany({ where: { profileId: profile.id }, select: { normalizedName: true } }),
      db.engagement.findMany({
        where: { profileId: profile.id },
        select: { role: true, company: true },
      }),
    ]);

    const haveSkill = new Set(existingSkills.map((s) => s.normalizedName));
    const newSkills = parsed.skills
      .map((name) => ({ name, normalizedName: normalizeSkill(name) }))
      .filter((s) => s.normalizedName && !haveSkill.has(s.normalizedName))
      // A resume can name the same skill twice in different casing.
      .filter((s, i, all) => all.findIndex((o) => o.normalizedName === s.normalizedName) === i);

    const haveEngagement = new Set(existingEngagements.map(engagementKey));
    const newEngagements = parsed.engagements
      .filter((e) => !haveEngagement.has(engagementKey(e)))
      .filter((e, i, all) => all.findIndex((o) => engagementKey(o) === engagementKey(e)) === i)
      // Highlights enrich facet text at extraction time only — Engagement has no column.
      .map(({ role, company, span }) => ({ role, company, span }));

    const updated = await db.talentProfile.update({
      where: { id: profile.id },
      select: { publishedAt: true },
      data: {
        headline: parsed.headline,
        summary: parsed.summary,
        city: parsed.city,
        yearsExperience: parsed.yearsExperience,
        // A rate the resume itself states beats the model's market estimate.
        rateUsd: profile.rateUsd ?? parsed.preferences.desiredRateUsd ?? parsed.suggestedRateUsd,
        // Parsed values only ever FILL a blank field here. Anything the user
        // already answered outranks a fresh guess about the same fact.
        portfolioUrl: profile.portfolioUrl ?? parsed.portfolioUrl,
        linkedinUrl: profile.linkedinUrl ?? parsed.linkedinUrl,
        githubUrl: profile.githubUrl ?? parsed.githubUrl,
        education: profile.education ?? educationSummary(parsed.education),
        englishLevel: profile.englishLevel ?? parsed.englishLevel,
        tools: profile.tools ?? parsed.tools,
        certifications: profile.certifications ?? (parsed.certifications.join(", ") || null),
        preferredOverlap: profile.preferredOverlap ?? parsed.preferences.timezoneOverlap,
        noticePeriodDays: profile.noticePeriodDays ?? parsed.preferences.noticePeriodDays,
        // Non-nullable with a 0 default, so 0 is the only "unanswered" value.
        committedHours:
          profile.committedHours || (committedFromAvailable(parsed.preferences.hoursPerWeek) ?? 0),
        resumeKey: key,
        lastEditedAt: new Date(),
        // Flags persist across re-uploads: a stripped injection attempt stays on
        // the record until an admin clears it, so a second clean upload can't be
        // used to wash the first one. Set-union, so re-uploading doesn't stack
        // duplicates of the same flag.
        ...(flags.length ? { flags: { set: [...new Set([...profile.flags, ...flags])] } } : {}),
        skills: { create: newSkills },
        engagements: { create: newEngagements },
      },
    });

    // Re-uploading onto an ALREADY published profile rewrites the exact text
    // the vectors were built from (headline, summary, skills, engagements), so
    // without this the pool ranks a person who no longer exists. Publish stays
    // the embed boundary — a draft is deliberately left un-embedded. Best-effort
    // like the PATCH route: a hiccup must not lose the parse itself.
    if (updated.publishedAt) {
      try {
        await refreshProfileEmbeddings(profile.id);
      } catch (e) {
        console.error("[talent/resume/parse] re-embed after parse failed", e);
      }
    }

    // A parse writes new Skill rows and the tools free text, both of which
    // ProfileTool is derived from (engine-plan 2a).
    try {
      await syncProfileTools(profile.id);
    } catch (e) {
      console.error("[talent/resume/parse] tool sync after parse failed", e);
    }

    return ok({ parsed });
  } catch (e) {
    return fail(e);
  }
}
