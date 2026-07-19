import { WorkspaceShell } from "@/components/workspace";

export default function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell role="talent">{children}</WorkspaceShell>;
}
