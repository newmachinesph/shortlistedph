import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Legal", ...NOINDEX };

const policies = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Data Privacy Act notice", href: "/privacy" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default async function EmployerLegalPage() {
  await requirePageUser("employer");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Legal</h1>
      <p className="mt-1 text-sm text-ink-soft">The policies that govern shortlisted.ph.</p>

      <h2 className="mt-7 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Policies
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {policies.map((p, i) => (
          <Link
            key={p.label}
            href={p.href}
            className={`flex items-center justify-between px-6 py-4 text-sm text-ink transition-colors hover:bg-paper ${
              i < policies.length - 1 ? "border-b border-line" : ""
            }`}
          >
            {p.label} <ChevronRight className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
          </Link>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-medium text-ink">Contracts are between you and the talent</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          shortlisted.ph is not a party to your engagement and does not supply contract templates or
          compliance packets. We never store or forward candidate ID documents — candidates present
          those to you directly.
        </p>
      </div>
    </>
  );
}
