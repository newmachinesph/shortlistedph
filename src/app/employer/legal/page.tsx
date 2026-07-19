import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";

const templates = ["PH Independent Contractor Agreement", "Mutual NDA", "IP Assignment"];

const policies = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Data Privacy Act notice", href: "/privacy" },
];

export default function EmployerLegalPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Legal</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Compliance records, contract templates, and the policies that govern shortlisted.ph.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Compliance packet</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-4">
          <div>
            <p className="font-medium text-ink">Kristine Bautista</p>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" /> Identity attestation certificate
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" /> E-signed agreement
              </li>
            </ul>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            <Download className="h-4 w-4" /> Download packet
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          We attest identity — we never store or forward candidate ID documents.
        </p>
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Contract templates
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {templates.map((t, i) => (
          <div
            key={t}
            className={`flex items-center justify-between px-6 py-4 ${
              i < templates.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <p className="text-sm text-ink">{t}</p>
            <button className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        ))}
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Policies
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {policies.map((p, i) => (
          <Link
            key={p.label}
            href={p.href}
            className={`block px-6 py-4 text-sm text-ink hover:bg-paper ${i < policies.length - 1 ? "border-b border-line" : ""}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
    </>
  );
}
