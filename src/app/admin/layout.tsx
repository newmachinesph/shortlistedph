import { redirect } from "next/navigation";
import { requireAdmin, type SessionUser } from "@/lib/session";
import { AdminNav } from "./nav";
import { AccountMenu } from "./account-menu";

/**
 * The gate for the whole back office. requireAdmin() needs both the admin role
 * and an ADMIN_EMAILS allowlist hit; anything short of that lands on the
 * marketing site with no hint that this route exists.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin: SessionUser;
  try {
    admin = await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-paper">
      <AdminNav />
      <div className="pt-14 lg:pt-0 lg:pl-56">
        <div className="mx-auto flex max-w-5xl justify-end px-4 pt-3 sm:px-8 lg:pt-5">
          <AccountMenu name={admin.name} email={admin.email} />
        </div>
        <main className="mx-auto max-w-5xl px-4 pb-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
