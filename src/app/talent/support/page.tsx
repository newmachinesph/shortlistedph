import type { Metadata } from "next";
import { AlertTriangle, ChevronRight, HelpCircle, Mail } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Support", ...NOINDEX };

const faqs = [
  { label: "How matching works", href: "/pricing" },
  { label: "Why can't I see job posts?", href: "/pricing" },
  {
    label: "Report a suspicious employer",
    href: "mailto:support@shortlisted.ph?subject=Suspicious%20employer",
  },
  { label: "Code of Conduct", href: "/conduct" },
];

// ponytail: reporting goes to support by email. A Report row needs a target
// user id and there is no create endpoint or target picker — a real form would
// span files outside this page. Wire this to POST /api/reports when that lands.
const REPORT_MAILTO =
  "mailto:support@shortlisted.ph?subject=Illegal%20recruitment%20report" +
  "&body=Who%20asked%20you%20for%20money%3A%0AWhat%20they%20asked%20for%3A%0AWhen%20it%20happened%3A%0AWhere%20(here%2C%20Facebook%2C%20text%2C%20etc.)%3A%0A";

export default async function TalentSupportPage() {
  await requirePageUser("talent");

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

      <section className="mt-5 rounded-2xl border border-ember/30 bg-ember-soft p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ember" strokeWidth={1.75} />
          <div>
            <h2 className="font-medium text-ink">Never pay anyone to get placed</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
              Placement fees are illegal recruitment. If anyone asks you for money to be shortlisted
              or hired — on or off shortlisted.ph — report it immediately.
            </p>
            <a
              href={REPORT_MAILTO}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-white"
            >
              <Mail className="h-4 w-4" strokeWidth={1.75} /> Report by email to support
            </a>
            <p className="mt-2 text-xs text-ink-faint">
              Opens your email app with the details we need. Include screenshots if you have them.
            </p>
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
