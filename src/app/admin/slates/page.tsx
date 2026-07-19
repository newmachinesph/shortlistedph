import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { listSlates } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Slates", ...NOINDEX };

export default async function AdminSlates() {
  const slates = await listSlates();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Slates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every shortlist delivered, newest first. Unlocked means the employer paid.
      </p>

      <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-white">
        {slates.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ListChecks className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <h2 className="font-display mt-4 text-lg font-semibold text-ink">No slates yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Slates appear once a job description finishes matching.
            </p>
          </div>
        ) : (
          slates.map((s, i) => (
            <div
              key={s.id}
              className={`flex flex-wrap items-center gap-4 px-6 py-4 ${
                i < slates.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.jd.title}</p>
                <p className="truncate text-xs text-ink-faint">
                  {s.jd.employer.companyName} · {s._count.entries} candidate
                  {s._count.entries === 1 ? "" : "s"} · delivered{" "}
                  {s.deliveredAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {s.unlockedAt
                    ? ` · unlocked ${s.unlockedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  s.status === "unlocked" ? "bg-brand-soft text-brand" : "bg-ember-soft text-ember"
                }`}
              >
                {s.status}
              </span>
              <Link
                href={`/employer/briefs/${s.jd.id}`}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
              >
                Open
              </Link>
            </div>
          ))
        )}
      </div>
    </>
  );
}
