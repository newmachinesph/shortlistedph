import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

/**
 * Server side because the answer to "are you already someone?" decides whether
 * this page signs you up or only finishes an account that exists. Google users
 * and anyone whose role write failed mid-signup arrive here with a live session
 * and no profile row — they need the picker, not a second account.
 */
export default async function RegisterPage() {
  const user = await getSessionUser();

  if (user) {
    // Onboarded already: /api/onboarding/role would 409, so send them home
    // rather than showing a picker that cannot be used.
    if (user.role === "admin") redirect("/admin");
    const existing = await db.user.findUnique({
      where: { id: user.id },
      select: { talentProfile: { select: { id: true } }, employer: { select: { id: true } } },
    });
    if (existing?.employer) redirect("/employer");
    if (existing?.talentProfile) redirect("/talent");
  }

  return <RegisterForm signedIn={Boolean(user)} />;
}
