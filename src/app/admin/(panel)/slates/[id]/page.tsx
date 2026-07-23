import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EyeOff } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { getSlateForReview, timeAgo } from "@/lib/admin";
import type { Dims } from "@/lib/scoring";
import type { FrozenProfile } from "@/lib/slate";
import { Avatar } from "@/components/avatar";
import { ApproveSlateButton } from "../actions";

export const metadata: Metadata = { title: "Admin · Review slate", ...NOINDEX };

const slateChip: Record<string, string> = {
  pending_review: "bg-ember-soft text-ember",
  preview: "bg-ember-soft text-ember",
  unlocked: "bg-brand-soft text-brand",
};

const dimLabels: [key: keyof Dims, label: string][] = [
  ["skills", "Skills"],
  ["rate", "Rate fit"],
  ["overlap", "Timezone"],
  ["experience", "Experience"],
];

// Consent lifecycle chips. "pending" = created but not yet emailed (approval or
// the kill switch hasn't released it); "sent" = candidate is deciding.
const consentChip: Record<string, string> = {
  pending: "bg-line text-ink-soft",
  sent: "bg-ember-soft text-ember",
  accepted: "bg-brand-soft text-brand",
  declined: "bg-line text-ink-soft",
  expired: "bg-ember-soft text-ember",
};

/**
 * Read-only review of one slate, unmasked. Admins cannot open the employer's
 * brief page (role redirect, by design) — this is where a pending_review slate
 * gets looked at before the Approve button releases it.
 */
export default async function AdminSlateReview({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) redirect("/");
    throw e;
  }

  const { id } = await params;
  const slate = await getSlateForReview(id);
  if (!slate) notFound();

  const { jd } = slate;

  return (
    <>
      <Link href="/admin/slates" className="text-sm text-ink-faint hover:text-brand">
        ← Slates
      </Link>

      <div className="mt-3 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <EyeOff className="h-3.5 w-3.5" />
              <span>Hidden job description · {jd.employer.companyName}</span>
            </div>
            <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink">
              {jd.title}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {jd.budgetMin != null && jd.budgetMax != null
                ? `$${jd.budgetMin}–${jd.budgetMax}/hr · `
                : ""}
              {jd.hoursPerWeek ? `${jd.hoursPerWeek}h/wk · ` : ""}
              {jd.overlap ? `overlap ${jd.overlap}` : "no overlap requirement"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                slateChip[slate.status] ?? slateChip.preview
              }`}
            >
              {slate.status.replace(/_/g, " ")}
            </span>
            {slate.status === "pending_review" && <ApproveSlateButton slateId={slate.id} />}
          </div>
        </div>
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
      </div>

      {slate.consents.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Proposed candidates — consent status
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {slate.consents.map((c, i) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 ${
                  i < slate.consents.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <span className="font-display w-5 text-sm font-semibold text-ink-faint">
                  {i + 1}
                </span>
                <Avatar name={c.name} image={c.image} size="sm" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{c.name}</p>
                <span className="text-xs text-ink-faint">
                  {c.respondedAt
                    ? `responded ${timeAgo(c.respondedAt)}`
                    : c.sentAt
                      ? `sent ${timeAgo(c.sentAt)}`
                      : "not emailed yet"}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    consentChip[c.status] ?? consentChip.pending
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            In invitation order — scores are computed when a candidate accepts and lands below.
            Consent emails go out when you approve; unanswered requests expire after 48 hours.
          </p>
        </section>
      )}

      <div className="mt-8 mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          {slate.entries.length} confirmed — names visible to you only
        </h2>
        <span className="text-xs text-ink-faint">built {timeAgo(slate.deliveredAt)}</span>
      </div>

      <ol className="space-y-4">
        {slate.entries.map((entry) => {
          const p = entry.snapshot.frozenJson as FrozenProfile;
          const dims = entry.dims as Dims;
          return (
            <li key={entry.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
              <div className="flex flex-wrap gap-4 sm:gap-5">
                <div className="flex items-start gap-4">
                  <span className="font-display text-lg font-semibold text-ink-faint">
                    {entry.rank}
                  </span>
                  <Avatar name={entry.name} image={entry.image} size="md" />
                </div>
                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                  <h3 className="font-medium text-ink">{entry.name}</h3>
                  <p className="text-sm text-ink-soft">
                    {p.headline}
                    {p.city ? ` · ${p.city}` : ""}
                    {p.rateUsd ? ` · $${p.rateUsd}/hr` : ""}
                  </p>
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
                            style={{ width: `${dims[key]}%` }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
