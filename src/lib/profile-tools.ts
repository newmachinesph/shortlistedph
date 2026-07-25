import "server-only";
import { db } from "./db";
import { canonicalizeTool, isKnownTool } from "./tools/aliases";
import { normalizeSkill } from "./scoring";

/**
 * Keeps ProfileTool in step with the profile it is derived from.
 *
 * ProfileTool shipped with a one-off backfill and no runtime writer, so it was
 * stale the moment anyone edited a skill and empty for every profile created
 * afterwards. A table nothing writes is worse than no table: it looks like data.
 *
 * The rule from the alias table holds — only names the table KNOWS become
 * canonical tools. Anything else stays prose on the Skill row and is never
 * guessed into a canonical, because a wrong merge credits someone with a tool
 * they do not have.
 *
 * Called after any write that changes a profile's skills or tools text. Cheap
 * (two small queries plus a diff) and idempotent, so callers can fire it
 * best-effort without ordering concerns.
 */
export async function syncProfileTools(profileId: string): Promise<{ added: number; removed: number }> {
  const [profile, skills, existing] = await Promise.all([
    db.talentProfile.findUnique({ where: { id: profileId }, select: { tools: true } }),
    db.skill.findMany({ where: { profileId }, select: { name: true, normalizedName: true } }),
    db.profileTool.findMany({ where: { profileId }, select: { id: true, canonicalId: true } }),
  ]);
  if (!profile) return { added: 0, removed: 0 };

  // canonical → the name as the talent wrote it, first writer wins.
  const wanted = new Map<string, string>();
  for (const s of skills) {
    if (isKnownTool(s.normalizedName)) {
      const canonical = canonicalizeTool(s.normalizedName);
      if (!wanted.has(canonical)) wanted.set(canonical, s.name);
    }
  }
  for (const raw of (profile.tools ?? "").split(",")) {
    const name = raw.trim();
    if (!name) continue;
    const normalized = normalizeSkill(name);
    if (!isKnownTool(normalized)) continue;
    const canonical = canonicalizeTool(normalized);
    if (!wanted.has(canonical)) wanted.set(canonical, name);
  }

  const have = new Set(existing.map((t) => t.canonicalId));
  const toAdd = [...wanted].filter(([canonical]) => !have.has(canonical));
  // Removing a skill has to remove its tool. Without this the table was
  // additive-only and a dropped skill lived on forever as a canonical tool.
  const toRemove = existing.filter((t) => !wanted.has(t.canonicalId)).map((t) => t.id);

  if (toAdd.length > 0) {
    await db.profileTool.createMany({
      data: toAdd.map(([canonicalId, name]) => ({ profileId, canonicalId, name })),
      skipDuplicates: true,
    });
  }
  if (toRemove.length > 0) {
    await db.profileTool.deleteMany({ where: { id: { in: toRemove } } });
  }

  return { added: toAdd.length, removed: toRemove.length };
}
