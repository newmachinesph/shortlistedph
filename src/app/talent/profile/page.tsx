import Link from "next/link";
import { BadgeCheck, Camera, Check, Globe, Lock } from "lucide-react";
import { getTalentProfile, requirePageUser, talentOrOnboard } from "@/lib/queries";
import { initials } from "@/lib/format";


export default async function TalentProfilePage() {
  const user = await requirePageUser("talent");
  await talentOrOnboard(user.id);
  const profile = await getTalentProfile(user.id);
  if (!profile) return null;

  const { stableDays, isRateLocked } = profile;
  const isPublished = profile.publishedAt !== null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Your standing profile
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            This is the one profile every job description is matched against. There is nothing to
            tailor — keep it true instead.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            isPublished ? "bg-brand-soft text-brand" : "bg-ember-soft text-ember"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          {isPublished ? "Visible to matching" : "Not published yet"}
        </span>
      </div>

      {!isPublished && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ember-soft px-6 py-5">
          <p className="max-w-md text-sm leading-relaxed text-ink">
            Your profile isn&rsquo;t in the matching pool yet — finish onboarding to publish it.
          </p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Finish setup
          </Link>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-white p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            {initials(profile.user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-ink">{profile.user.name}</h2>
              {profile.verifiedTier === "id_verified" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  <BadgeCheck className="h-3.5 w-3.5" /> ID verified
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-soft">{profile.headline ?? "No headline yet"}</p>
            <p className="mt-1 text-sm text-ink-faint">
              {profile.city ? `${profile.city} · ` : ""}
              {profile.yearsExperience} yrs · {profile.availability}
            </p>
          </div>
        </div>
        {profile.summary && (
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">{profile.summary}</p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
          <Camera className="h-3.5 w-3.5" />
          <span>Stable for {stableDays} days — stability strengthens your ranking.</span>
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Standing rate
          </h2>
          <p className="font-display mt-3 text-3xl font-semibold text-ink">
            {profile.rateUsd ? `$${profile.rateUsd}/hr` : "Not set"}
          </p>
          {isRateLocked && profile.rateLockedUntil && (
            <p className="mt-1 text-sm text-ink-soft">
              Locked until {profile.rateLockedUntil.toISOString().slice(0, 10)}
            </p>
          )}
          <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            One rate for every employer. Changes lock for 30 days and your rate history is visible
            to employers who shortlist you.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Verification
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center gap-2.5 text-ink-faint">
              <span className="h-4 w-4 rounded-full border border-line" />
              <span>Identity verification: optional, ₱60 for the check</span>
            </li>
            <li className="flex items-center gap-2.5 text-ink-faint">
              <span className="h-4 w-4 rounded-full border border-line" />
              <span>NBI clearance — on hand, shown at hire</span>
            </li>
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Your documents never live on shortlisted.ph. When you&rsquo;re hired, you present
              them directly to your employer — your choice, your copies.
            </span>
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Skills</h2>
          {profile.skills.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">No skills yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                    s.confirmed
                      ? "bg-brand-soft font-medium text-brand"
                      : "border border-line text-ink-soft"
                  }`}
                >
                  {s.confirmed && <Check className="h-3.5 w-3.5" />}
                  {s.name}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Checked skills were confirmed by a past engagement outcome. Both parties confirming how
            an engagement ended is what turns a claim into proof.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Engagement history
          </h2>
          {profile.engagements.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">No engagements yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {profile.engagements.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{h.role}</p>
                    <p className="text-sm text-ink-soft">
                      {h.company} · {h.span}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      h.outcome === "confirmed"
                        ? "bg-brand-soft text-brand"
                        : "border border-line text-ink-faint"
                    }`}
                  >
                    {h.outcome === "confirmed" ? "Outcome confirmed" : "Self-reported"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
