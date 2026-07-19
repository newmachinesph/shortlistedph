import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in", ...NOINDEX };

import Link from "next/link";
import { Logo } from "@/components/logo";
import { isGoogleEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      {/* Decided server-side: an unconfigured provider must not be offered. */}
      <LoginForm showGoogle={isGoogleEnabled} />
    </div>
  );
}
