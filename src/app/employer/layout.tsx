import { WorkspaceShell } from "@/components/workspace";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { initials } from "@/lib/format";


export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  return (
    <WorkspaceShell
      role="employer"
      persona={{
        name: employer.companyName,
        sub: employer.location ?? user.email,
        initials: initials(employer.companyName),
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
