import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Eye, Lock } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Legal", ...NOINDEX };

const policies = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Data Privacy Act notice", href: "/privacy" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default async function TalentLegalPage() {
  await requirePageUser("talent");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Legal</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Your rights over your data, and where your documents live (hint: not here).
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <Eye className="h-4 w-4" strokeWidth={1.75} /> Who saw my profile
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          The access log is not available yet. We do not have a record we can honestly show you of
          every time your profile was viewed, so this page shows nothing rather than a guess.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Under the Data Privacy Act you can still request every record of how your data has been
          accessed or shared. Email{" "}
          <a
            href="mailto:support@shortlisted.ph?subject=Data%20access%20request"
            className="font-medium text-brand hover:underline"
          >
            support@shortlisted.ph
          </a>{" "}
          and we will answer with what we hold.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <Lock className="h-4 w-4" strokeWidth={1.75} /> Your documents
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Your ID and NBI clearance are never uploaded to shortlisted.ph. When you&rsquo;re hired, you
          present them directly to your employer — your documents, your choice.
        </p>
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Policies
      </h2>
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
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
      </section>
    </>
  );
}
