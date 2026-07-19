import { WorkspaceShell } from "@/components/workspace";

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell role="employer">{children}</WorkspaceShell>;
}
