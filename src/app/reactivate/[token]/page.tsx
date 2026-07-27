import type { Metadata } from "next";
import Link from "next/link";
import { MailX } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { getProfileByReactivationToken } from "@/lib/reactivation";
import { ReactivateForm } from "./reactivate-form";

export const metadata: Metadata = { title: "Your imported profile", ...NOINDEX };

/**
 * PUBLIC re-activation page — no login. The migrated pool has no Account row,
 * so the emailed token is the whole credential, exactly like /consent/[token].
 *
 * Everything imported is shown before the choice is offered: someone deciding
 * whether to publish or delete a record about themselves has to be able to
 * read it first. The three options are presented as equals — there is no
 * primary call to action here, deliberately.
 */
export default async function ReactivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const profile = await getProfileByReactivationToken(token);

  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-2xl">
        <p className="font-display mb-4 text-center text-lg font-semibold text-ink">
          shortlisted<span className="text-ember">.ph</span>
        </p>

        {!profile ? (
          // Spent tokens are cleared, so "already used" and "never existed" are
          // the same row state. Saying both is the honest answer, and for the
          // common case — someone re-opening the link after deciding — the
          // useful one is "you already have a password now".
          <div className="rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
            <MailX className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
            <h1 className="font-display mt-4 text-lg font-semibold text-ink">
              This link is no longer valid
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
              Re-activation links work once. If you already made your choice,
              your account has a password now — sign in with it. If you deleted
              your profile, it is gone and there is nothing left to open.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Sign in
              </Link>
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 items-center rounded-xl px-5 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
              >
                Reset my password
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Your remotetalentph profile has moved
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              You created this on remotetalentph. It was moved to
              shortlisted.ph, and it is not visible to anyone: no employer has
              seen it, it has never been put in front of anyone, and nothing
              changes until you choose below. We&rsquo;re asking because you
              never agreed to be shown to employers here.
            </p>

            <div className="mt-5 rounded-xl border border-line bg-paper p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                What we hold
              </p>
              <h2 className="mt-2 font-medium text-ink">
                {profile.headline ?? "No headline was imported"}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {profile.user.name} · {profile.user.email}
                {profile.city ? ` · ${profile.city}` : ""}
                {profile.yearsExperience > 0
                  ? ` · ${profile.yearsExperience} yrs experience`
                  : ""}
                {profile.rateUsd != null ? ` · $${profile.rateUsd}/hr` : ""}
              </p>

              {profile.summary && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {profile.summary}
                </p>
              )}

              {profile.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Skills
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.engagements.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Work history
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {profile.engagements.map((e) => (
                      <li key={e.id} className="text-sm text-ink-soft">
                        <span className="font-medium text-ink">{e.role}</span> ·{" "}
                        {e.company}
                        {e.span ? ` · ${e.span}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                This is everything imported about you. You can correct any of it
                once you&rsquo;re in — nothing here is fixed.
              </p>
            </div>

            <ReactivateForm token={token} />
          </div>
        )}
      </div>
    </main>
  );
}
