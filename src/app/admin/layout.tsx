import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { AdminNav } from "./nav";

/**
 * The gate for the whole back office. requireAdmin() needs both the admin role
 * and an ADMIN_EMAILS allowlist hit; anything short of that lands on the
 * marketing site with no hint that this route exists.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-paper">
      <AdminNav />
      <div className="pt-14 lg:pt-0 lg:pl-56">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
