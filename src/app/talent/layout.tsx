import { WorkspaceShell } from "@/components/workspace";
import { requirePageUser, talentOrOnboard } from "@/lib/queries";

const initialsOf = (name: string) =>
  name.split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("talent");
  const profile = await talentOrOnboard(user.id);

  return (
    <WorkspaceShell
      role="talent"
      persona={{
        name: user.name,
        sub: profile.headline ?? user.email,
        initials: initialsOf(user.name),
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
