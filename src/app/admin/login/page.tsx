import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";
import { Logo } from "@/components/logo";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign-in", ...NOINDEX };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Logo />
      <AdminLoginForm />
    </div>
  );
}
