"use client";

import { useState } from "react";
import { Building2, Check, Clock, EyeOff, X } from "lucide-react";

export default function ConnectionsPage() {
  const [decision, setDecision] = useState<"pending" | "accepted" | "declined">("pending");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Connections</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Employers who shortlisted you and want to talk. You see their full
        job description before anything is shared.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
              <Building2 className="h-5 w-5 text-brand" />
            </span>
            <div>
              <h2 className="font-medium text-ink">Harbor Dental Group</h2>
              <p className="text-sm text-ink-soft">3-location dental group · Austin, TX</p>
            </div>
          </div>
          {decision === "pending" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              <Clock className="h-3 w-3" /> Awaiting your consent
            </span>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-paper p-5">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <EyeOff className="h-3.5 w-3.5" />
            <span>
              Their job description — revealed to you because you were
              shortlisted #1 of 5
            </span>
          </p>
          <h3 className="mt-2 font-medium text-ink">Medical VA for a growing dental group</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            $8–11/hr · 40h/week · ≥ 4h EST overlap · US dental practice
            experience, insurance verification, phone-heavy front desk.
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            Employer track record: responds in ~6h · 92% response rate · 2
            confirmed hires via shortlisted.ph
          </p>
        </div>

        {decision === "pending" && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDecision("accepted")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              <Check className="h-4 w-4" /> Accept — share my contact details
            </button>
            <button
              onClick={() => setDecision("declined")}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
            >
              <X className="h-4 w-4" /> Decline
            </button>
            <p className="w-full text-xs text-ink-faint sm:w-auto">
              Declining is invisible to future matching.
            </p>
          </div>
        )}
        {decision === "accepted" && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
            <Check className="h-4 w-4" />
            Connected. Harbor Dental Group can now see your contact details —
            expect a message about scheduling an interview.
          </p>
        )}
        {decision === "declined" && (
          <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
            Declined. The employer only sees that this slot reopened — never
            your reason.
          </p>
        )}
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Past connections
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
              <Building2 className="h-5 w-5 text-ink-faint" />
            </span>
            <div>
              <h3 className="font-medium text-ink">US medspa chain</h3>
              <p className="text-sm text-ink-soft">Connected Mar 2026 · interviewed, role paused</p>
            </div>
          </div>
          <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
            Closed
          </span>
        </div>
      </div>
    </>
  );
}
