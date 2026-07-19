import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Camera, EyeOff, Lock, ScanSearch } from "lucide-react";
import { briefById, slates } from "@/data/briefs";
import { candidateById, initials } from "@/data/candidates";

const dimLabels: [key: "skills" | "rate" | "overlap" | "experience", label: string][] = [
  ["skills", "Skills"],
  ["rate", "Rate fit"],
  ["overlap", "Timezone"],
  ["experience", "Experience"],
];

export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = briefById(id);
  if (!brief) notFound();
  const slate = slates[id];

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
          {brief.title}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          ${brief.budgetMin}–{brief.budgetMax}/hr · {brief.hoursPerWeek}h/wk · overlap {brief.overlap}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {brief.mustHaves.map((m) => (
            <span key={m} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              {m}
            </span>
          ))}
          {brief.niceToHaves.map((m) => (
            <span key={m} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
              {m}
            </span>
          ))}
        </div>
      </div>

      {!slate ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-10 text-center">
          <ScanSearch className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">Matching in progress</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            {brief.candidatesScanned} profiles scanned so far. Your ranked
            shortlist lands in roughly 18 hours — we&rsquo;ll email you.
          </p>
        </div>
      ) : (
        <>
          {!brief.unlocked && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <p className="max-w-md text-sm font-medium leading-relaxed text-white">
                  Free preview — your slate is ranked and ready. Unlock names,
                  dossiers, and connection requests for $49.
                </p>
              </div>
              <button className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft">
                Unlock shortlist — $49
              </button>
            </div>
          )}
          <div className="mt-8 mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
              Your shortlist — {slate.length} of {brief.candidatesScanned} scanned
            </h2>
            <span className="text-xs text-ink-faint">Ranked by fit</span>
          </div>
          <ol className="space-y-4">
            {slate.map((entry, i) => {
              const c = candidateById(entry.candidateId);
              if (!c) return null;
              return (
                <li key={entry.candidateId} className="rounded-2xl border border-line bg-white p-6">
                  <div className="flex flex-wrap gap-5">
                    <div className="flex items-start gap-4">
                      <span className="font-display text-lg font-semibold text-ink-faint">
                        {i + 1}
                      </span>
                      <span
                        className={`font-display flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand ${
                          brief.unlocked ? "" : "select-none blur-[3px]"
                        }`}
                      >
                        {initials(c.name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {brief.unlocked ? (
                          <h3 className="font-medium text-ink">{c.name}</h3>
                        ) : (
                          <h3
                            aria-label="Name hidden until unlocked"
                            className="select-none font-medium text-ink blur-[5px]"
                          >
                            {c.name}
                          </h3>
                        )}
                        {c.idVerified && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                            ID verified
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                          <Camera className="h-3 w-3" />
                          <span>snapshot · stable {c.profileStableDays}d before job posted</span>
                        </span>
                      </div>
                      <p className="text-sm text-ink-soft">
                        {c.headline} · {c.city} · ${c.rateUsd}/hr (unchanged {c.rateStableMonths} mo)
                      </p>
                      <ul className="mt-3 space-y-1">
                        {entry.reasons.map((r) => (
                          <li key={r} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                            {r}
                          </li>
                        ))}
                      </ul>
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
                    {brief.unlocked ? (
                      <>
                        <Link
                          href={`/employer/candidates/${c.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                        >
                          View dossier <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark">
                          Request connection
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
                        <Lock className="h-3.5 w-3.5" />
                        Dossier and connection locked — unlock the shortlist to
                        contact this candidate
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-ink-faint">
            Candidates consent before any contact details are exchanged. Names
            and profiles shown were frozen when your job was posted — edits
            since then are not reflected here.
          </p>
        </>
      )}
    </>
  );
}
