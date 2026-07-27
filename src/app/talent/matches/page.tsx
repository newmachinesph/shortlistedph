import type { Metadata } from "next";
import { CalendarClock, Check, Clock3, Inbox, X } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { isConsentExpired } from "@/lib/consent";
import { candidateRoleLabel } from "@/lib/openings-shape";
import { rateBand } from "@/lib/format";
import { stamp } from "@/lib/notify";
import { requirePageUser, talentOrOnboard } from "@/lib/queries";
// The same buttons the emailed page uses, posting to the same public token
// endpoint — the accept/decline logic lives in lib/consent and is not
// reimplemented here.
import { RespondButtons } from "@/components/consent-respond-buttons";

export const metadata: Metadata = { title: "Match invitations", ...NOINDEX };

/**
 * Match invitations, in-app.
 *
 * The 48-hour window and the one-strike dormancy penalty ran on email alone: a
 * filtered or missed message cost the candidate a strike with no way to see it
 * coming. Same generic JD facts as the emailed page — the employer's identity
 * never rides a consent.
 *
 * Only SENT invitations appear. An unsent row has no clock running yet and
 * showing it would leak a match the cron has not delivered.
 */
export default async function TalentMatchesPage() {
  const user = await requirePageUser("talent");
  const profile = await talentOrOnboard(user.id);

  const consents = await db.matchConsent.findMany({
    where: { profileId: profile.id, sentAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100, // ponytail: hard cap, paginate if any account ever hits it
    select: {
      id: true,
      token: true,
      status: true,
      expiresAt: true,
      jd: {
        select: {
          // The employer-authored `title` can name the client, so it is not
          // selected — same door the public board uses (candidateRoleLabel).
          publicTitle: true,
          roleFamily: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          mustHaves: true,
        },
      },
    },
  });

  // Expiry is derived, not stored until something detects it — a row can read
  // "pending" long after its window closed.
  const rows = consents.map((c) => ({
    ...c,
    state: isConsentExpired(c) ? "expired" : c.status,
  }));
  const open = rows.filter((r) => r.state === "pending");
  const settled = rows.filter((r) => r.state !== "pending");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Match invitations
      </h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
        A job matched your profile. Nothing about you reaches the employer until you say yes, and
        the ranking that got you here was frozen before you saw the role. You get 48 hours;
        declining costs you nothing, but letting one lapse pauses new matches until you next open
        this workspace.
      </p>

      {rows.length === 0 && (
        <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <Inbox className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No invitations yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            You&rsquo;re invisible until a job matches you. When one does, it lands here and in
            your email at the same time — there is nothing to apply to in the meantime.
          </p>
        </div>
      )}

      {open.map((c) => (
        <div key={c.id} className="mt-7 rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-medium text-ink">{candidateRoleLabel(c.jd)}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              <Clock3 className="h-3 w-3" /> Awaiting your answer
            </span>
          </div>

          <p className="mt-1 text-sm text-ink-soft">
            {[
              rateBand(c.jd.budgetMin, c.jd.budgetMax),
              c.jd.hoursPerWeek ? `${c.jd.hoursPerWeek}h/week` : null,
              c.jd.overlap ? `overlap ${c.jd.overlap}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {c.jd.mustHaves.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.jd.mustHaves.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          <RespondButtons token={c.token} />

          {c.expiresAt && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Answer by {stamp(c.expiresAt)}
            </p>
          )}
        </div>
      ))}

      {settled.length > 0 && (
        <>
          <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Answered
          </h2>
          <div className="space-y-4">
            {settled.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-6 py-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{candidateRoleLabel(c.jd)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {c.state === "accepted"
                      ? "You're on this shortlist as your profile stood when you accepted."
                      : c.state === "declined"
                        ? "You passed. It never counts against you."
                        : "The 48-hour window closed before you answered."}
                  </p>
                </div>
                {c.state === "accepted" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                    <Check className="h-3 w-3" /> Accepted
                  </span>
                ) : c.state === "declined" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
                    <X className="h-3 w-3" /> Declined
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                    <Clock3 className="h-3 w-3" /> Expired
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
