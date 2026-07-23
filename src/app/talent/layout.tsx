import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Talent workspace", ...NOINDEX };

import { WorkspaceShell } from "@/components/workspace";
import { hasUnreadNotifications, requirePageUser, talentOrOnboard } from "@/lib/queries";
import { initials } from "@/lib/format";


export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("talent");
  const [profile, hasUnread] = await Promise.all([
    talentOrOnboard(user.id),
    hasUnreadNotifications(user.id),
  ]);

  return (
    <WorkspaceShell
      role="talent"
      hasUnread={hasUnread}
      persona={{
        name: user.name,
        sub: profile.headline ?? user.email,
        initials: initials(user.name),
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
