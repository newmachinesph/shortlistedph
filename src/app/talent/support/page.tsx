import type { Metadata } from "next";
import { AlertTriangle, ChevronRight, HelpCircle, Mail } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { listTalentConnections, requirePageUser } from "@/lib/queries";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = { title: "Support", ...NOINDEX };

const faqs = [
  { label: "How matching works", href: "/pricing" },
  { label: "Why can't I see job posts?", href: "/pricing" },
  { label: "Report a suspicious employer", href: "#report" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default async function TalentSupportPage() {
  const user = await requirePageUser("talent");
  const connections = await listTalentConnections(user.id);
  const counterparts = Array.from(
    new Map(
      connections.map((c) => {
        const employer = c.slateEntry.snapshot.jd.employer;
        return [employer.userId, { id: employer.userId, label: employer.companyName }];
      }),
    ).values(),
  );

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Support</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Questions, issues, or something that doesn&rsquo;t feel right — we&rsquo;re here.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
            <Mail className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-medium text-ink">support@shortlisted.ph</p>
            <p className="text-sm text-ink-soft">Typical response under 24 hours</p>
          </div>
        </div>
      </section>

      <section id="report" className="mt-5 rounded-2xl border border-ember/30 bg-ember-soft p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ember" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-ink">Never pay anyone to get placed</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
              Placement fees are illegal recruitment. If anyone asks you for money to be shortlisted
              or hired — on or off shortlisted.ph — report it here. It goes straight to our team.
            </p>
            <ReportForm
              counterparts={counterparts}
              detailPlaceholder="Who asked you for money, what they asked for, when it happened, and where (here, Facebook, text…)"
            />
          </div>
        </div>
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Frequently asked
      </h2>
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {faqs.map((q, i) => (
          <a
            key={q.label}
            href={q.href}
            className={`flex items-center justify-between gap-3 px-6 py-4 text-sm text-ink hover:bg-paper ${
              i < faqs.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="flex items-center gap-2.5">
              <HelpCircle className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
              {q.label}
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
          </a>
        ))}
      </section>
    </>
  );
}
