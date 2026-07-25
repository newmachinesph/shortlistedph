import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requireAdminPage, timeAgo } from "@/lib/admin";
import { listPendingVerifications } from "@/lib/verification";
import { VerificationActions } from "./actions";

export const metadata: Metadata = { title: "Admin · Verifications", ...NOINDEX };

export default async function AdminVerifications() {
  await requireAdminPage();
  const pending = await listPendingVerifications();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Verifications</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Identity attempts waiting on a human. Approving is the only thing on the platform that
        grants the verified badge — paying for it does not.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Pending review
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {pending.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BadgeCheck className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <p className="mt-3 text-sm text-ink-soft">Nothing waiting on review.</p>
          </div>
        ) : (
          pending.map((v, i) => (
            <div key={v.id} className={`px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-medium text-ink">{v.user.name}</p>
                  <p className="break-all text-xs text-ink-faint">
                    {v.user.email} · applied {timeAgo(v.createdAt)}
                    {v.user.talentProfile?.verifiedTier === "id_verified"
                      ? " · already badged"
                      : ""}
                  </p>
                  {v.user.talentProfile?.headline && (
                    <p className="mt-1 text-sm text-ink-soft">{v.user.talentProfile.headline}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-faint">
                    Provider ref: {v.diditSessionRef ?? "none — collected off-platform"}
                  </p>
                </div>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(v.user.email)}`}
                  className="text-xs font-medium text-brand hover:text-brand-dark"
                >
                  Open account
                </Link>
              </div>
              <VerificationActions userId={v.user.id} />
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Rejecting withdraws any badge the account already had and re-opens checkout, so someone
        who failed once can try again.
      </p>
    </>
  );
}
