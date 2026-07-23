import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flag, Mail } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { employerOrOnboard, listEmployerConnections, requirePageUser } from "@/lib/queries";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = { title: "Support", ...NOINDEX };

const faqs = [
  { label: "Billing & credits", href: "/employer/billing" },
  { label: "Re-slate policy", href: "/employer/briefs" },
  { label: "Report a candidate", href: "#report" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default async function EmployerSupportPage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const connections = await listEmployerConnections(employer.id);
  const counterparts = Array.from(
    new Map(
      connections.map((c) => {
        const u = c.slateEntry.snapshot.profile.user;
        return [u.id, { id: u.id, label: u.name }];
      }),
    ).values(),
  );

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Support</h1>
      <p className="mt-1 text-sm text-ink-soft">
        We&rsquo;re here for billing questions, disputes, and anything about how matching works.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
              <Mail className="h-5 w-5 text-brand" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-medium text-ink">support@shortlisted.ph</p>
              <p className="text-sm text-ink-soft">Typical response time under 24 hours</p>
            </div>
          </div>
          <a
            href="mailto:support@shortlisted.ph"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Email support
          </a>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Support runs over email — there is no ticket queue in the app, so nothing to track here.
        </p>
      </div>

      <section id="report" className="mt-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-brand" strokeWidth={1.75} />
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Report a candidate
          </h2>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          Misrepresented experience, no-shows, or conduct issues — file it here and our team
          investigates.
        </p>
        <ReportForm
          counterparts={counterparts}
          detailPlaceholder="What happened, when, and in which engagement — include anything that helps us verify it."
        />
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Frequently asked
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {faqs.map((f, i) => (
          <Link
            key={f.label}
            href={f.href}
            className={`flex items-center justify-between px-6 py-4 text-sm text-ink transition-colors hover:bg-paper ${
              i < faqs.length - 1 ? "border-b border-line" : ""
            }`}
          >
            {f.label} <ChevronRight className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
          </Link>
        ))}
      </div>
    </>
  );
}
