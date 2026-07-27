import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CalendarClock,
  Camera,
  CircleAlert,
  EyeOff,
  FileEdit,
  Lock,
  Radar,
  ScanSearch,
  SearchX,
} from "lucide-react";
import { db } from "@/lib/db";
import { SLATE_SIZE, jdHardRequirements } from "@/lib/matching";
import { eliminationCounts, employerOrOnboard, getSlateForJd, requirePageUser } from "@/lib/queries";
import { availabilityHint, availabilityStatus, freshnessNote } from "@/lib/availability";
import { activeInterviewers, employerPrice, INTERVIEW_DURATION_MINUTES } from "@/lib/interviews";
import { RequestConnection } from "@/components/request-connection";
import { InterviewPool } from "@/components/interview-pool";
import { UnlockButton } from "./unlock-button";
import { CloseRoleButton } from "./close-button";

const dimLabels: [key: "skills" | "rate" | "overlap" | "experience", label: string][] = [
  ["skills", "Skills"],
  ["rate", "Rate fit"],
  // "Capacity", not "Timezone": this dimension is scoreOverlap, which compares
  // free weekly hours against the hours the brief asks for. Timezone overlap is
  // not computed yet — see docs/engine/gap-analysis.md P2-2.
  ["overlap", "Capacity"],
  ["experience", "Experience"],
];

/**
 * Stage 0 eliminations in the employer's own terms. Counts only, by reason —
 * who got eliminated is never the employer's to see, so no identity crosses
 * this boundary.
 */
function eliminationLines(counts: Record<string, number>, rateCeiling: number | null): string[] {
  const lines: string[] = [];
  const above = counts.rate_above_ceiling ?? 0;
  const short = counts.hours_short ?? 0;
  if (above > 0) {
    const ceiling = rateCeiling != null ? `$${rateCeiling}/hr ` : "";
    lines.push(`${above} ${above === 1 ? "match was" : "matches were"} above your ${ceiling}ceiling`);
  }
  if (short > 0) {
    lines.push(`${short} did not have enough free hours a week for this load`);
  }
  // No "already at capacity" line: a booked candidate is filtered out of the
  // pool query itself now (lib/matching.ts), so Stage 0 never sees one and the
  // count is permanently 0. Rows written before that change stay in the table
  // and are deliberately not surfaced.
  return lines;
}

function EliminationNotes({ lines, className }: { lines: string[]; className?: string }) {
  if (lines.length === 0) return null;
  return (
    <ul className={`space-y-1.5 ${className ?? ""}`}>
      {lines.map((line) => (
        <li key={line} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ember" />
          {line}
        </li>
      ))}
    </ul>
  );
}

export default async function SlatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const jd = await db.jobDescription.findFirst({ where: { id, employerId: employer.id } });
  if (!jd) notFound();

  const slate = await getSlateForJd(jd.id, employer.id);

  // Availability is a LIVE signal — read now off each candidate's current
  // TalentProfile, never from the frozen snapshot. Keyed by slate-entry id so
  // it lines up with the masked entries getSlateForJd returns. While the slate
  // is locked we render only a non-identifying hint (or nothing).
  const liveRows = slate
    ? await db.slateEntry.findMany({
        where: { slateId: slate.slateId },
        select: {
          id: true,
          snapshot: {
            select: {
              profile: {
                select: {
                  openToOffers: true,
                  availability: true,
                  noticePeriodDays: true,
                  availabilityConfirmedAt: true,
                },
              },
            },
          },
        },
      })
    : [];
  const slateUnlocked = slate?.unlocked ?? false;
  const availLine = new Map<string, string | null>();
  for (const r of liveRows) {
    const live = r.snapshot.profile;
    availLine.set(
      r.id,
      slateUnlocked
        ? `${availabilityStatus(live)} · ${freshnessNote(live.availabilityConfirmedAt)}`
        : availabilityHint(live),
    );
  }

  // So an already-requested candidate shows as requested after a refresh.
  const requested = await db.connection.findMany({
    where: { slateEntry: { slate: { jdId: jd.id } } },
    select: { slateEntryId: true },
  });
  const requestedIds = new Set(requested.map((r) => r.slateEntryId));

  // Interview entry point only exists on an unlocked slate, so the pool and the
  // already-requested set are only worth fetching there.
  const interviewPool = slate?.unlocked
    ? (await activeInterviewers()).map((iv) => ({
        id: iv.id,
        name: iv.user.name,
        bio: iv.bio,
        expertise: iv.expertise,
        languages: iv.languages,
        yearsExperience: iv.yearsExperience,
        priceUsd: employerPrice(),
      }))
    : [];
  // Stage 0 eliminations are only worth reading when there is a thin or empty
  // slate to explain — a full shortlist needs no excuse, and a draft has never
  // been ranked, so there is nothing to count.
  const elimLines =
    jd.status !== "draft" &&
    (jd.status === "no_matches" || (slate?.entries.length ?? 0) < SLATE_SIZE)
      ? eliminationLines(await eliminationCounts(jd.id), jdHardRequirements(jd).rateMaxUsd ?? null)
      : [];

  const interviewedIds = new Set<string>();
  if (slate?.unlocked) {
    const live = await db.interview.findMany({
      where: {
        slateEntry: { slate: { jdId: jd.id } },
        status: { notIn: ["declined", "cancelled"] },
      },
      select: { slateEntryId: true },
    });
    for (const i of live) interviewedIds.add(i.slateEntryId);
  }

  return (
    <>
      <Link href="/employer" className="text-sm text-ink-faint hover:text-brand">
        ← Dashboard
      </Link>

      <div className="mt-3 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hidden job description · candidates never see this</span>
        </div>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink">
          {jd.title}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {jd.budgetMin != null && jd.budgetMax != null ? `$${jd.budgetMin}–${jd.budgetMax}/hr · ` : ""}
          {jd.hoursPerWeek ? `${jd.hoursPerWeek}h/wk · ` : ""}
          {jd.overlap ? `overlap ${jd.overlap}` : "no overlap requirement"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {jd.mustHaves.map((m) => (
            <span key={m} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              {m}
            </span>
          ))}
          {jd.niceToHaves.map((m) => (
            <span key={m} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
              {m}
            </span>
          ))}
        </div>
        {jd.status !== "closed" && jd.status !== "draft" && (
          <div className="mt-5 border-t border-line pt-4">
            <CloseRoleButton jdId={jd.id} />
          </div>
        )}
      </div>

      {/* A closed role keeps its shortlist — the employer may have paid for it —
          so this is a banner over the normal view, not a replacement for it. */}
      {jd.status === "closed" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-white px-6 py-4">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <p className="text-sm leading-relaxed text-ink-soft">
            You closed this role. Matching has stopped and no further candidates will be asked to
            confirm. Anything already unlocked stays yours below.
          </p>
        </div>
      )}

      {jd.status === "draft" ? (
        // Never posted, so nothing is in progress and nobody has been ranked —
        // without this branch a draft fell through to "matching and review in
        // progress" and waited on work that was never started.
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <FileEdit className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">Still a draft</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Nothing has been matched against this yet — posting it is what starts the ranking.
            Nobody sees it until then, and posting costs nothing.
          </p>
          <Link
            href={`/employer/briefs/${jd.id}/edit`}
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Finish and post it
          </Link>
        </div>
      ) : jd.status === "no_matches" ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <SearchX className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">
            No one cleared the bar
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            We ranked the market against this job description and nobody was a strong enough match
            to put in front of you. You have not been charged, and no credit was used.
          </p>
          <EliminationNotes lines={elimLines} className="mx-auto mt-4 max-w-md text-left" />
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-faint">
            Padding a shortlist with near-misses would waste your time and ours. Try widening the
            must-haves or the budget band — we&rsquo;ll re-run the match.
          </p>
          <Link
            href="/employer/briefs/new"
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Adjust and try again
          </Link>
        </div>
      ) : jd.status === "failed" ? (
        // Terminal, and NOT "in progress" — nothing will move without us.
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <CircleAlert className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">Matching failed</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Something broke on our side while ranking the market against this job description — this
            is not a verdict on your brief, and nothing was charged. We can re-run it for you.
          </p>
          <Link
            href="/employer/support"
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Ask us to re-run it
          </Link>
        </div>
      ) : jd.status === "matching" || jd.status === "rematching" ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <ScanSearch className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">
            {jd.status === "rematching" ? "Re-ranking the market" : "Ranking the market"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            We&rsquo;re scoring every published profile against this job description. The candidates
            who clear the bar are then asked to confirm they&rsquo;re available — nobody appears on
            your shortlist without agreeing first.
          </p>
        </div>
      ) : !slate ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <ScanSearch className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">
            Matching and review in progress
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Your shortlist appears here once it clears review.
          </p>
        </div>
      ) : slate.entries.length === 0 ? (
        // Approved, but nobody has confirmed yet: candidates consent before
        // they appear, so the slate starts empty and fills in live.
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <Radar className="mx-auto h-8 w-8 text-brand" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">
            Confirming availability with your matches
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            We matched candidates against this brief and are confirming each one is
            available and interested. Confirmed candidates appear here as they
            respond — we&rsquo;re also sourcing from other channels in parallel.
          </p>
          <EliminationNotes lines={elimLines} className="mx-auto mt-4 max-w-md text-left" />
        </div>
      ) : (
        <>
          {!slate.unlocked && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <p className="max-w-md text-sm font-medium leading-relaxed text-white">
                  Free preview — your slate is ranked and ready. Unlock names, dossiers, and
                  connection requests for $49.
                </p>
              </div>
              <UnlockButton slateId={slate.slateId} credits={employer.credits} />
            </div>
          )}

          {slate.entries.length < SLATE_SIZE && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-white px-6 py-4">
              <Radar className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} />
              <div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Your shortlist is still growing — we&rsquo;re confirming availability
                  with more matched candidates and sourcing from other channels.
                </p>
                <EliminationNotes lines={elimLines} className="mt-2.5" />
              </div>
            </div>
          )}

          <div className="mt-8 mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
              Your shortlist — {slate.entries.length} confirmed
            </h2>
            <span className="text-xs text-ink-faint">In order of confirmation</span>
          </div>

          <ol className="space-y-4">
            {slate.entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap gap-4 sm:gap-5">
                  <div className="flex items-start gap-4">
                    <span className="font-display text-lg font-semibold text-ink-faint">
                      {entry.rank}
                    </span>
                    <span
                      className={`font-display flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand ${
                        entry.locked ? "select-none blur-[3px]" : ""
                      }`}
                    >
                      {entry.initials}
                    </span>
                  </div>
                  <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-medium text-ink ${entry.locked ? "select-none blur-[4px]" : ""}`}>
                        {entry.name ?? "Candidate name hidden"}
                      </h3>
                      {entry.verified && (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                          ID verified
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                        <Camera className="h-3 w-3" />
                        <span>snapshot · stable {entry.profileStableDays}d before posting</span>
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft">
                      {entry.headline}
                      {entry.city ? ` · ${entry.city}` : ""}
                      {entry.rateUsd ? ` · $${entry.rateUsd}/hr` : ""}
                    </p>
                    {availLine.get(entry.id) && (
                      <p
                        className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${
                          slate.unlocked
                            ? "text-brand"
                            : "rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand"
                        }`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {availLine.get(entry.id)}
                      </p>
                    )}
                    {entry.reasons.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {entry.reasons.map((r) => (
                          <li key={r} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.skills.map((s) => (
                        <span
                          key={s.name}
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            s.confirmed
                              ? "bg-brand-soft font-medium text-brand"
                              : "border border-line text-ink-soft"
                          }`}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex w-full flex-row items-center gap-5 sm:w-44 sm:flex-col sm:items-end">
                    <p className="font-display text-3xl font-semibold text-brand">{entry.score}</p>
                    <div className="w-full max-w-40 space-y-1.5">
                      {dimLabels.map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-16 text-right text-[10px] text-ink-faint">{label}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                            <span
                              className="block h-full rounded-full bg-brand"
                              style={{ width: `${entry.dims[key]}%` }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  {entry.snapshotId ? (
                    <>
                      <Link
                        href={`/employer/candidates/${entry.snapshotId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                      >
                        View dossier <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <RequestConnection
                        slateEntryId={entry.id}
                        alreadyRequested={requestedIds.has(entry.id)}
                      />
                      <InterviewPool
                        slateEntryId={entry.id}
                        candidateName={entry.name ?? "this candidate"}
                        interviewers={interviewPool}
                        durationMinutes={INTERVIEW_DURATION_MINUTES}
                        alreadyRequested={interviewedIds.has(entry.id)}
                      />
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
                      <Lock className="h-3.5 w-3.5" />
                      Dossier and connection locked — unlock the shortlist to contact this candidate
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm leading-relaxed text-ink-faint">
            Candidates consent before any contact details are exchanged. Profiles shown were frozen
            when this job description was posted — edits since then are not reflected here.
          </p>
        </>
      )}
    </>
  );
}
