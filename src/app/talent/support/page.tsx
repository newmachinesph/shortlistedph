import { AlertTriangle, ChevronRight, HelpCircle, Mail } from "lucide-react";

const faqs = [
  { label: "How matching works", href: "/pricing" },
  { label: "Why can't I see job posts?", href: "/pricing" },
  { label: "Report a suspicious employer", href: "mailto:support@shortlisted.ph" },
  { label: "Code of Conduct", href: "/conduct" },
];

export default function TalentSupportPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Support</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Questions, issues, or something that doesn&rsquo;t feel right — we&rsquo;re here.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
            <Mail className="h-5 w-5 text-brand" />
          </span>
          <div>
            <p className="font-medium text-ink">support@shortlisted.ph</p>
            <p className="text-sm text-ink-soft">Typical response under 24 hours</p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-ember/30 bg-ember-soft p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div>
            <h2 className="font-medium text-ink">Never pay anyone to get placed</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
              Placement fees are illegal recruitment. If anyone asks you for
              money to be shortlisted or hired — on or off shortlisted.ph —
              report it here immediately.
            </p>
            <button className="mt-4 rounded-xl px-4 py-2 text-sm font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-white">
              Report
            </button>
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
              <HelpCircle className="h-4 w-4 text-ink-faint" />
              {q.label}
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </a>
        ))}
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Past tickets
      </h2>
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink">Rate change question</p>
            <p className="text-xs text-ink-faint">Jun 2026</p>
          </div>
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft">
            Closed
          </span>
        </div>
      </section>
    </>
  );
}
