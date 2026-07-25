import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Briefcase, Clock, Lock, TrendingUp } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { getTalentProfile, requirePageUser } from "@/lib/queries";
import { stamp } from "@/lib/notify";

export const metadata: Metadata = { title: "Rate card", ...NOINDEX };

const AVAILABILITY: Record<string, string> = {
  open: "Open to new work",
  partial: "Partly committed",
  booked: "Fully booked",
};

export default async function TalentServicesPage() {
  const user = await requirePageUser("talent");
  const profile = await getTalentProfile(user.id);
  if (!profile) redirect("/onboarding");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your rate card</h1>
      <p className="mt-1 text-sm text-ink-soft">
        What every hidden job description is matched against — one rate, no negotiation theater.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
            <Briefcase className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </span>
          {profile.isRateLocked && profile.rateLockedUntil && (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              locked until {stamp(profile.rateLockedUntil)}
            </span>
          )}
        </div>
        <h2 className="mt-4 font-medium text-ink">{profile.headline ?? "Your standing rate"}</h2>
        {profile.rateUsd == null ? (
          <>
            <p className="font-display mt-2 text-3xl font-semibold text-ink-faint">Not set</p>
            <p className="mt-1 text-sm text-ink-soft">
              Without a rate the engine cannot match you against a budget — you will not appear on
              shortlists.
            </p>
          </>
        ) : (
          <p className="font-display mt-2 text-3xl font-semibold text-ink">${profile.rateUsd}/hr</p>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} /> Rate history
          </h2>
          {profile.rateChanges.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              No changes recorded. Every time you change your rate it is logged here, and employers
              who shortlist you see the same history.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {profile.rateChanges.map((change) => (
                <li key={change.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">
                    {change.oldRate == null
                      ? `Set to $${change.newRate}/hr`
                      : `$${change.oldRate}/hr → $${change.newRate}/hr`}
                  </span>
                  <span className="text-xs text-ink-faint">{stamp(change.changedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <Clock className="h-4 w-4" strokeWidth={1.75} /> Availability
          </h2>
          <p className="mt-4 font-medium text-ink">
            {AVAILABILITY[profile.availability] ?? profile.availability}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{profile.committedHours}h/week committed</p>
          <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            You set your committed hours — nothing updates them for you. Whatever is left of a
            40-hour week is what we offer employers, so keep it current when a client ends.
          </p>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-line bg-white p-5 text-xs leading-relaxed text-ink-faint">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>Rate changes lock for 30 days once submitted — plan ahead before adjusting.</span>
      </div>
    </>
  );
}
