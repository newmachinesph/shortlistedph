import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "Company profile", ...NOINDEX };

/** Nothing here is editable yet — the fields come from registration. */
export default async function EmployerProfilePage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const fields: [string, string | null][] = [
    ["Location", employer.location],
    ["Contact", employer.contactName],
    ["About", employer.blurb],
  ];

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Company profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        No business verification required — your track record on shortlisted.ph is your reputation.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            {initials(employer.companyName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-ink">{employer.companyName}</h2>
            <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
          </div>
        </div>

        <dl className="mt-7 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wider text-ink-faint">{label}</dt>
              <dd className={value ? "mt-1.5 text-sm text-ink" : "mt-1.5 text-sm text-ink-faint"}>
                {value ?? "Not set"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-6">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Candidates see your company name and this description when they decide whether to accept a
          connection. Editing is not available yet — email support@shortlisted.ph to change anything
          here.
        </p>
      </div>
    </>
  );
}
