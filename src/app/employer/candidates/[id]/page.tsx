import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Camera, Check, Lock } from "lucide-react";
import { employerOrOnboard, getSnapshotForEmployer, requirePageUser } from "@/lib/queries";
import type { FrozenProfile } from "@/lib/slate";
import { initials } from "@/lib/format";
import { RequestConnection } from "@/components/request-connection";

const availabilityLabel: Record<string, string> = {
  open: "Open to full-time",
  partial: "Partially committed",
  booked: "Fully booked",
};


export default async function CandidateDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const found = await getSnapshotForEmployer(id, employer.id);
  if (!found) notFound();

  const { snapshot, unlocked, slateEntry } = found;
  const p = snapshot.frozenJson as FrozenProfile;
  const backHref = `/employer/briefs/${snapshot.jd.id}`;

  if (!unlocked) {
    return (
      <>
        <Link href={backHref} className="text-sm text-ink-faint hover:text-brand">
          ← Back to shortlist
        </Link>
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
            <Lock className="h-5 w-5 text-brand" />
          </span>
          <h1 className="font-display mt-4 text-lg font-semibold text-ink">Dossier locked</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Unlock this shortlist to see names, full profiles, and request connections.
          </p>
          <Link
            href={backHref}
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Back to the slate
          </Link>
        </div>
      </>
    );
  }

  const name = snapshot.profile.user.name;

  return (
    <>
      <Link href={backHref} className="text-sm text-ink-faint hover:text-brand">
        ← Back to shortlist
      </Link>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-ember-soft px-5 py-3.5 text-sm text-ember">
        <Camera className="h-4 w-4 shrink-0" />
        <span>
          Snapshot view — this profile is shown as it existed when your job description was posted.
          It was last edited {p.profileStableDays} days before that.
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{name}</h1>
              {p.verifiedTier === "id_verified" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  <BadgeCheck className="h-3.5 w-3.5" /> ID verified
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-soft">{p.headline}</p>
            <p className="mt-1 text-sm text-ink-faint">
              {p.city ? `${p.city} · ` : ""}
              {p.yearsExperience} yrs experience · {availabilityLabel[p.availability] ?? p.availability}
              {p.committedHours > 0 ? ` (${p.committedHours}h/wk committed)` : ""}
            </p>
          </div>
          {p.rateUsd != null && (
            <div className="rounded-2xl bg-brand-soft px-5 py-4 text-right">
              <p className="font-display text-2xl font-semibold text-brand">${p.rateUsd}/hr</p>
              <p className="mt-0.5 text-xs text-ink-soft">standing rate</p>
            </div>
          )}
        </div>
        {p.summary && <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">{p.summary}</p>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.skills.map((s) => (
              <span
                key={s.name}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                  s.confirmed ? "bg-brand-soft font-medium text-brand" : "border border-line text-ink-soft"
                }`}
              >
                {s.confirmed && <Check className="h-3.5 w-3.5" />}
                {s.name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            <Check className="mr-1 inline h-3 w-3 text-brand" />= confirmed by a past engagement
            outcome. Unmarked skills are self-reported.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Engagement history
          </h2>
          <ul className="mt-4 space-y-4">
            {p.engagements.map((h) => (
              <li key={h.role + h.span} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{h.role}</p>
                  <p className="text-sm text-ink-soft">
                    {h.company} · {h.span}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    h.outcome === "confirmed" ? "bg-brand-soft text-brand" : "border border-line text-ink-faint"
                  }`}
                >
                  {h.outcome === "confirmed" ? "Outcome confirmed" : "Self-reported"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-6">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Documents stay with the candidate.</span>{" "}
          Verification on shortlisted.ph is optional, and IDs, NBI clearance, and certificates are
          never stored or forwarded by us — candidates present them to you directly once you hire.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {slateEntry && (
          <RequestConnection
            slateEntryId={slateEntry.id}
            alreadyRequested={slateEntry.connection !== null}
            size="lg"
          />
        )}
        <p className="text-xs text-ink-faint">
          {name.split(" ")[0]} must consent before contact details are shared.
        </p>
      </div>
    </>
  );
}
