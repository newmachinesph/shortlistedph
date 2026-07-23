import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { INTERVIEW_STATUSES, type InterviewStatus } from "@/lib/interviews";
import { stamp } from "@/lib/notify";
import { PayoutCreate, PayoutSettle } from "@/components/interview-admin-payout";

export const metadata: Metadata = { title: "Admin · Interviews", ...NOINDEX };

const usd = (n: number) => `$${n.toFixed(2)}`;

function isStatus(value: string | undefined): value is InterviewStatus {
  return !!value && (INTERVIEW_STATUSES as readonly string[]).includes(value);
}

async function load(filter?: InterviewStatus) {
  const [interviewsRaw, pendingPayoutsRaw, uncoveredRaw] = await Promise.all([
    db.interview.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        priceUsd: true,
        interviewerPayoutUsd: true,
        scheduledAt: true,
        createdAt: true,
        recordingKey: true,
        employer: { select: { companyName: true } },
        interviewer: { select: { user: { select: { name: true } } } },
        talent: { select: { name: true, email: true } },
      },
    }),
    db.interviewerPayout.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        interviewer: { select: { user: { select: { name: true, email: true } } } },
        _count: { select: { interviews: true } },
      },
    }),
    // Reported interviews no payout has claimed yet — the money currently owed.
    db.interview.findMany({
      where: { status: "reported", payoutId: null },
      select: {
        interviewerId: true,
        interviewerPayoutUsd: true,
        interviewer: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const interviews = interviewsRaw.map((iv) => ({
    ...iv,
    priceUsd: Number(iv.priceUsd),
    interviewerPayoutUsd: Number(iv.interviewerPayoutUsd),
  }));
  const pendingPayouts = pendingPayoutsRaw.map((p) => ({ ...p, amount: Number(p.amount) }));
  const uncovered = uncoveredRaw.map((i) => ({ ...i, interviewerPayoutUsd: Number(i.interviewerPayoutUsd) }));

  // Group the owed interviews per interviewer so each gets one "create payout" row.
  const owedMap = new Map<string, { name: string; count: number; total: number }>();
  for (const i of uncovered) {
    const cur = owedMap.get(i.interviewerId) ?? { name: i.interviewer.user.name, count: 0, total: 0 };
    cur.count += 1;
    cur.total += i.interviewerPayoutUsd;
    owedMap.set(i.interviewerId, cur);
  }
  const owed = [...owedMap.entries()]
    .map(([interviewerId, v]) => ({
      interviewerId,
      name: v.name,
      count: v.count,
      total: Math.round(v.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  return { interviews, pendingPayouts, owed };
}

export default async function AdminInterviews({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) redirect("/");
    throw e;
  }

  const { status } = await searchParams;
  const filter = isStatus(status) ? status : undefined;
  const { interviews, pendingPayouts, owed } = await load(filter);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Interviews</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every interview across the platform. Watch the pipeline, spot stuck ones, review recordings,
        and settle what interviewers are owed.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Interviewer payouts
      </h2>
      <p className="mb-3 max-w-2xl text-xs leading-relaxed text-ink-faint">
        Reported interviews owe the interviewer their locked USD rate. A payout covers every unpaid
        reported interview for one interviewer. Amounts are USD earned — settle to PHP by hand at the
        rate on the day you transfer, and put the peso reference in the settle field. There is no FX
        rate in this system.
      </p>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {owed.length === 0 && pendingPayouts.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">Nothing owed or pending.</p>
        ) : (
          <>
            {owed.map((o, i) => (
              <div
                key={o.interviewerId}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">{o.name}</p>
                  <p className="text-xs text-ink-faint">
                    {o.count} reported interview{o.count === 1 ? "" : "s"} unpaid
                  </p>
                </div>
                <span className="font-display text-sm font-semibold text-ink">{usd(o.total)}</span>
                <PayoutCreate interviewerId={o.interviewerId} />
              </div>
            ))}
            {pendingPayouts.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-4 py-4 sm:px-6"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">{p.interviewer.user.name}</p>
                  <p className="break-all text-xs text-ink-faint">
                    {p.interviewer.user.email} · {p.method} · {p._count.interviews} interview
                    {p._count.interviews === 1 ? "" : "s"} · requested {stamp(p.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-semibold text-ink">
                    {usd(p.amount)}
                  </span>
                  <span className="shrink-0 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                    pending
                  </span>
                </div>
                <PayoutSettle payoutId={p.id} />
              </div>
            ))}
          </>
        )}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        All interviews
      </h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href="/admin/interviews"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filter ? "bg-brand text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
          }`}
        >
          All
        </Link>
        {INTERVIEW_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/interviews?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === s ? "bg-brand text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {interviews.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            No interviews{filter ? ` with status "${filter}"` : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                  <th className="px-6 py-3 text-left font-medium">Candidate</th>
                  <th className="px-3 py-3 text-left font-medium">Company</th>
                  <th className="px-3 py-3 text-left font-medium">Interviewer</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Price</th>
                  <th className="px-3 py-3 text-right font-medium">Payout</th>
                  <th className="px-6 py-3 text-right font-medium">Recording</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((iv, i) => (
                  <tr key={iv.id} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-ink">{iv.talent.name}</p>
                      <p className="break-all text-xs text-ink-faint">{iv.talent.email}</p>
                      {iv.scheduledAt && (
                        <p className="text-xs text-ink-faint">{stamp(iv.scheduledAt)}</p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-ink-soft">{iv.employer.companyName}</td>
                    <td className="px-3 py-3.5 text-ink-soft">{iv.interviewer.user.name}</td>
                    <td className="px-3 py-3.5">
                      <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                        {iv.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right text-ink">{usd(iv.priceUsd)}</td>
                    <td className="px-3 py-3.5 text-right text-ink-soft">
                      {usd(iv.interviewerPayoutUsd)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {iv.recordingKey ? (
                        <a
                          href={`/api/admin/interviews/${iv.id}/recording`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark"
                        >
                          <PlayCircle className="h-4 w-4" strokeWidth={1.75} /> Watch
                        </a>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
