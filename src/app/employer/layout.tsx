import { WorkspaceShell } from "@/components/workspace";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  return (
    <WorkspaceShell
      role="employer"
      persona={{
        name: employer.companyName,
        sub: employer.location ?? user.email,
        initials: initialsOf(employer.companyName),
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
