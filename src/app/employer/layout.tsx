import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Employer workspace", ...NOINDEX };

import { WorkspaceShell } from "@/components/workspace";
import { employerOrOnboard, hasUnreadNotifications, requirePageUser } from "@/lib/queries";


export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("employer");
  const [employer, hasUnread] = await Promise.all([
    employerOrOnboard(user.id),
    hasUnreadNotifications(user.id),
  ]);

  return (
    <WorkspaceShell
      role="employer"
      hasUnread={hasUnread}
      persona={{
        name: employer.companyName,
        sub: employer.location ?? user.email,
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
