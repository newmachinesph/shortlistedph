import Link from "next/link";
import { ChevronRight, Clock, Mail } from "lucide-react";

const tickets = [{ subject: "Question about three-pack invoice", status: "Open", updated: "2h ago" }];

const faqs = [
  { label: "Billing & credits", href: "/employer/billing" },
  { label: "Re-slate policy", href: "/employer/briefs" },
  { label: "Report a candidate", href: "mailto:support@shortlisted.ph" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default function EmployerSupportPage() {
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
              <Mail className="h-5 w-5 text-brand" />
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
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Your tickets
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        {tickets.map((t) => (
          <div key={t.subject} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{t.subject}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                <Clock className="h-3 w-3" /> <span>Updated {t.updated}</span>
              </p>
            </div>
            <span className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              {t.status}
            </span>
          </div>
        ))}
      </div>

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
            {f.label} <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        ))}
      </div>
    </>
  );
}
