import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Down for maintenance", ...NOINDEX };

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight text-ink">
        We&rsquo;ll be right back
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        shortlisted.ph is down for scheduled maintenance.
      </p>
    </div>
  );
}
