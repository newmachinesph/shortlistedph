import Link from "next/link";
import { BadgeCheck, Camera, Check, Globe, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getTalentProfile, requirePageUser, talentOrOnboard } from "@/lib/queries";
import { AvatarUpload } from "@/components/avatar-upload";
import { availabilityLabel, freshnessNote, isStale } from "@/lib/availability";
import { AvailabilitySection } from "./availability-section";
import { EditDetails } from "./edit-details";
import { VerifyIdentity } from "./verify-identity";
import { VisibilityToggle } from "./visibility-toggle";

type VerificationStatus = "none" | "pending" | "verified" | "rejected";

export default async function TalentProfilePage() {
  const user = await requirePageUser("talent");
  await talentOrOnboard(user.id);
  const profile = await getTalentProfile(user.id);
  if (!profile) return null;

  // The badge follows verifiedTier, but the *attempt* lives on IdentityBinding —
  // pending and rejected have no representation on the profile row at all.
  const binding = await db.identityBinding.findUnique({
    where: { userId: user.id },
    select: { status: true, note: true },
  });
  const verificationStatus: VerificationStatus =
    profile.verifiedTier === "id_verified"
      ? "verified"
      : binding?.status === "pending" || binding?.status === "rejected"
        ? binding.status
        : "none";

  const { stableDays, isRateLocked } = profile;
  // Freshness copy is computed here, on the server, then handed down as strings —
  // the same reason relTime is server-computed: Date.now() must not run twice.
  const availLabel = availabilityLabel(profile);
  const availNote = freshnessNote(profile.availabilityConfirmedAt);
  const availStale = isStale(profile.availabilityConfirmedAt);
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
            isPublished && profile.visibility ? "bg-brand-soft text-brand" : "bg-ember-soft text-ember"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          {!isPublished
            ? "Not published yet"
            : profile.visibility
              ? "Visible to matching"
              : "Hidden from matching"}
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

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-5">
          <AvatarUpload name={profile.user.name} image={user.image} />
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
          {/* NOT a ranking input — composite() never sees this number. It is
              anti-tailoring evidence, and that is all it is. */}
          <span>
            Unchanged for {stableDays} days. Employers see how long your profile stood still
            before their job was posted — evidence you didn&rsquo;t tailor it to them.
          </span>
        </p>
      </div>

      <EditDetails
        profile={profile}
        skills={profile.skills}
        engagements={profile.engagements.map((e) => ({
          // The id is what makes a correction an edit of THIS row rather than
          // a fuzzy match on its text — see the diff in /api/talent/profile.
          id: e.id,
          role: e.role,
          company: e.company,
          span: e.span,
          confirmed: e.outcome === "confirmed",
        }))}
      />

      <VisibilityToggle visible={profile.visibility} />

      <AvailabilitySection
        initial={{
          openToOffers: profile.openToOffers,
          availability: profile.availability,
          noticePeriodDays: profile.noticePeriodDays,
        }}
        label={availLabel}
        note={availNote}
        stale={availStale}
      />

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
            <VerifyIdentity status={verificationStatus} note={binding?.note ?? null} />
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
