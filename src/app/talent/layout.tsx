import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Talent workspace", ...NOINDEX };

import { WorkspaceShell } from "@/components/workspace";
import { db } from "@/lib/db";
import { hasUnreadNotifications, requirePageUser, talentOrOnboard } from "@/lib/queries";


export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("talent");
  const [profile, hasUnread] = await Promise.all([
    talentOrOnboard(user.id),
    hasUnreadNotifications(user.id),
  ]);

  // One-strike forgiveness: visiting the workspace proves the person is alive,
  // so a dormancy flag (set when a consent request expired unanswered) clears
  // here. Guarded on the already-fetched row — the common case costs nothing.
  if (profile.dormantAt) {
    // Best-effort: a failed clear must not take the workspace down.
    await db.talentProfile
      .update({ where: { id: profile.id }, data: { dormantAt: null } })
      .catch((e) => console.error("[talent] could not clear dormantAt", e));
  }

  return (
    <WorkspaceShell
      role="talent"
      hasUnread={hasUnread}
      persona={{
        name: user.name,
        sub: profile.headline ?? user.email,
        image: user.image,
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
