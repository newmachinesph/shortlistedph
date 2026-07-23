import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { InterviewerToggle, InterviewerVet } from "@/components/interview-admin-vet";

export const metadata: Metadata = { title: "Admin · Interviewers", ...NOINDEX };

async function load() {
  const [pending, roster] = await Promise.all([
    db.interviewer.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
    db.interviewer.findMany({
      where: { status: { in: ["active", "paused"] } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { interviews: true } },
      },
    }),
  ]);
  return { pending, roster };
}

export default async function AdminInterviewers() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) redirect("/");
    throw e;
  }

  const { pending, roster } = await load();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Interviewers</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Vetted people who run paid interviews. Applications are not self-serve — approving one makes
        the person an interviewer and lets them into the portal. Approving flips their account role;
        pausing keeps them off the roster without removing them.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Pending applications
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {pending.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pending.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No applications waiting.</p>
        ) : (
          pending.map((iv, i) => (
            <div
              key={iv.id}
              className={`px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-medium text-ink">{iv.user.name}</p>
                  <p className="break-all text-xs text-ink-faint">
                    {iv.user.email} · {iv.yearsExperience}y exp · ${iv.rateUsd}/interview
                  </p>
                  {iv.bio && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{iv.bio}</p>}
                  {iv.expertise.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {iv.expertise.map((e) => (
                        <span
                          key={e}
                          className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                  {iv.languages.length > 0 && (
                    <p className="mt-1.5 text-xs text-ink-faint">
                      Languages: {iv.languages.join(", ")}
                    </p>
                  )}
                </div>
                <InterviewerVet interviewerId={iv.id} />
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Approving sets the interviewer active and flips the account to the interviewer role in one
        step. Rejecting removes the application; the person keeps their current role and can apply
        again.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Roster
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {roster.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {roster.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No active interviewers yet.</p>
        ) : (
          roster.map((iv, i) => (
            <div
              key={iv.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                <UserCheck className="h-5 w-5 text-brand" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-ink">{iv.user.name}</p>
                <p className="break-all text-xs text-ink-faint">
                  {iv.user.email} · ${iv.rateUsd}/interview · {iv._count.interviews} interview
                  {iv._count.interviews === 1 ? "" : "s"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  iv.status === "active" ? "bg-brand-soft text-brand" : "bg-ember-soft text-ember"
                }`}
              >
                {iv.status}
              </span>
              <InterviewerToggle interviewerId={iv.id} status={iv.status} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
