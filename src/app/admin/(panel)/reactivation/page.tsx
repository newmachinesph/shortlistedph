import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";
import { requireAdminPage } from "@/lib/admin";
import { reactivationStats } from "@/lib/reactivation";

export const metadata: Metadata = { title: "Admin · Re-activation", ...NOINDEX };

/**
 * Read-only. Sending is a CLI (scripts/send-reactivation.ts) on purpose —
 * a button that emails 785 people who never signed up here is one misclick
 * away from the exact thing this whole flow exists to avoid.
 */
export default async function AdminReactivation() {
  await requireAdminPage();
  const s = await reactivationStats();

  const cards = [
    { label: "Imported", value: s.imported, note: "profiles from remotetalentph" },
    { label: "Invited", value: s.invited, note: "have been emailed" },
    { label: "Re-activated", value: s.reactivated, note: "answered and set a password" },
    { label: "Published", value: s.published, note: "chose to enter matching" },
    { label: "Not yet invited", value: s.untouched, note: "still queued" },
  ];

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Re-activation</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The migrated pool is unpublished until each person says otherwise. Nobody here has been
        shown to an employer.
      </p>

      <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              {c.label}
            </dt>
            <dd className="font-display mt-2 text-3xl font-semibold text-ink">{c.value}</dd>
            <dd className="mt-1 text-sm text-ink-soft">{c.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-medium text-ink">Sending</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Invitations go out from the command line, dry-run by default. Nobody is ever emailed
          twice — a profile that already carries a send stamp is never picked up again.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-paper p-4 text-xs text-ink-soft">
          {`node --experimental-strip-types scripts/send-reactivation.ts --limit=25
node --experimental-strip-types scripts/send-reactivation.ts --limit=25 --commit`}
        </pre>
        <p className="mt-3 text-xs text-ink-faint">
          The outreach kill switch in Settings stops these sends like any other non-auth mail.
        </p>
      </div>
    </>
  );
}
