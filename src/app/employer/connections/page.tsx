import Link from "next/link";
import { Clock, EyeOff, MessageSquare } from "lucide-react";

export default function EmployerConnectionsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Connections</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Candidates who consented to share their contact details with you.
      </p>

      <div className="mt-7 space-y-4">
        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <span className="font-display flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
                KB
              </span>
              <div>
                <h2 className="font-medium text-ink">Kristine Bautista</h2>
                <p className="text-sm text-ink-soft">Medical VA — Davao City · $9/hr</p>
              </div>
            </div>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
              Connected Jul 16
            </span>
          </div>

          <div className="mt-5 rounded-xl bg-paper p-4 text-sm text-ink-soft">
            kristine.b•••@gmail.com · +63 917 ••• 4821
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/employer/messages"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              <MessageSquare className="h-4 w-4" /> Message
            </Link>
            <Link
              href="/employer/agreements"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
            >
              View agreement
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <span className="font-display flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
                LM
              </span>
              <div>
                <h2 className="font-medium text-ink">Louie Mendoza</h2>
                <p className="text-sm text-ink-soft">Medical biller — General Santos · $8/hr</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              <Clock className="h-3 w-3" /> Requested Jul 18 · awaiting consent
            </span>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Candidates usually respond within a day. You&rsquo;ll be notified the moment Louie decides.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper">
              <EyeOff className="h-5 w-5 text-ink-faint" />
            </span>
            <div>
              <h2 className="font-medium text-ink">A candidate declined your request</h2>
              <p className="text-sm text-ink-soft">
                That slot has reopened for matching. If fewer than 3 of 5 candidates consent, you&rsquo;ll get a free re-slate.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Their identity is never shared with you — only that the slot is open again.
          </p>
        </div>
      </div>
    </>
  );
}
