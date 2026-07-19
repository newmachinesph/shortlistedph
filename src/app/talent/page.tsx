import Link from "next/link";
import { ArrowRight, BadgeCheck, Camera, EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { getTalentProfile, requirePageUser, talentOrOnboard } from "@/lib/queries";
import { initials } from "@/lib/format";

export default async function TalentDashboard() {
  const user = await requirePageUser("talent");
  const base = await talentOrOnboard(user.id);
  const profile = await getTalentProfile(user.id);
  if (!profile) return null;

  const [timesShortlisted, pendingRequests, connectedCount] = await Promise.all([
    db.slateEntry.count({ where: { snapshot: { profileId: base.id } } }),
    db.connection.count({
      where: { state: "requested", slateEntry: { snapshot: { profileId: base.id } } },
    }),
    db.connection.count({
      where: { state: "consented", slateEntry: { snapshot: { profileId: base.id } } },
    }),
  ]);

  const isPublished = profile.publishedAt !== null;
  const firstName = user.name.split(" ")[0];

  const stats: [string, string, string][] = [
    ["Times shortlisted", String(timesShortlisted), "employer slates"],
    ["Connection requests", String(pendingRequests), "awaiting your consent"],
    ["Connected", String(connectedCount), "employers you accepted"],
    ["Profile stability", `${profile.stableDays}d`, "since your last edit"],
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="font-display flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-lg font-semibold text-brand">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Magandang araw, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Your profile is working while you aren&rsquo;t. Here&rsquo;s what it did.
          </p>
        </div>
      </div>

      {!isPublished && (
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ember-soft px-6 py-5">
          <p className="max-w-lg text-sm leading-relaxed text-ink">
            <span className="font-medium">Your profile isn&rsquo;t in the matching pool yet.</span>{" "}
            Until you publish it, employers can&rsquo;t be shown your profile at all.
          </p>
          <Link
            href="/onboarding"
            className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Finish setup
          </Link>
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="font-display mt-1.5 text-3xl font-semibold text-brand">{value}</dd>
            <dd className="mt-0.5 text-xs text-ink-faint">{sub}</dd>
          </div>
        ))}
      </dl>

      {pendingRequests > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5">
          <p className="text-sm font-medium text-white">
            {pendingRequests === 1
              ? "An employer wants to connect. You'll see their full job description before deciding."
              : `${pendingRequests} employers want to connect. You'll see each job description before deciding.`}
          </p>
          <Link
            href="/talent/connections"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            Review {pendingRequests === 1 ? "request" : "requests"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            How employers see you
          </h2>
          <ul className="mt-4 space-y-3.5 text-sm leading-relaxed text-ink-soft">
            <li className="flex gap-2.5">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                You&rsquo;re invisible until you land on a shortlist — no browsing, no cold outreach.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                Your profile has been stable for{" "}
                <span className="font-medium text-ink">{profile.stableDays} days</span>. Employers
                see it frozen as of the day their job was posted, so there is nothing to tailor.
              </span>
            </li>
            <li className="flex gap-2.5">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                {profile.verifiedTier === "id_verified"
                  ? "You're ID-verified. Your documents were never uploaded here."
                  : "Verification is optional. Your ID and NBI clearance never touch our servers — you show them to an employer only after hiring."}
              </span>
            </li>
          </ul>
          <Link
            href="/talent/profile"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            View your standing profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Your rate
          </h2>
          <p className="font-display mt-3 text-3xl font-semibold text-ink">
            {profile.rateUsd ? `$${profile.rateUsd}/hr` : "Not set"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {profile.isRateLocked && profile.rateLockedUntil
              ? `Locked until ${profile.rateLockedUntil.toISOString().slice(0, 10)}`
              : "One rate for every employer."}
          </p>
          <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            The engine matches your rate against verified experience, not ambition. Raise it by
            verifying more — not by asking for more.
          </p>
        </section>
      </div>
    </>
  );
}
