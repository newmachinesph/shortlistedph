"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApproveSlateButton({ slateId }: { slateId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/slates/${slateId}/approve`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Approval failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
      {error && <span className="w-full text-xs text-ember sm:w-auto sm:text-[11px]">{error}</span>}
      <button
        type="button"
        disabled={busy || pending}
        onClick={approve}
        className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0"
      >
        {busy || pending ? "Approving…" : "Approve"}
      </button>
    </div>
  );
}

export function StuckJdActions({ jdId, status }: { jdId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: "rematch" | "fail") {
    if (action === "fail" && !confirming) {
      setConfirming(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/slates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, jdId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; invited?: number; scanned?: number }
        | null;
      if (!res.ok) {
        setError(payload?.error ?? "Action failed");
        return;
      }
      if (action === "rematch") {
        setResult(
          payload?.invited
            ? `Matched ${payload.invited} of ${payload.scanned} scanned — consent requests go out on approval.`
            : "Matching finished with no candidates above the bar.",
        );
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const disabled = busy || pending;
  // A run already in flight owns the lock; a failed JD is terminal. no_matches
  // is re-runnable — the operator tunes must-haves, then tries again.
  const canRematch = status === "matching" || status === "no_matches";
  const canFail = status === "matching" || status === "rematching";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
      {error && <span className="w-full text-xs text-ember sm:w-auto sm:text-[11px]">{error}</span>}
      {result && (
        <span className="w-full text-xs text-ink-faint sm:w-auto sm:text-[11px]">{result}</span>
      )}
      {confirming && (
        <span className="w-full text-xs leading-relaxed text-ember sm:w-auto sm:text-[11px]">
          Marks this brief failed for the employer. Click again to confirm.
        </span>
      )}
      {canRematch && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => run("rematch")}
          className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
        >
          {busy ? "Matching…" : "Re-run matching"}
        </button>
      )}
      {canFail && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => run("fail")}
          className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
        >
          {confirming ? "Confirm mark failed" : "Mark failed"}
        </button>
      )}
    </div>
  );
}

/**
 * The "List publicly" block on slate review (docs/redesign-plan.md §3). The
 * openings board fails closed — nothing renders without an admin-approved
 * publicTitle + listedAt — so this form is the whole approval step.
 */
export function ListPubliclyForm({
  jdId,
  suggestedTitle,
  initial,
  roleFamilies,
  clientRegions,
}: {
  jdId: string;
  suggestedTitle: string;
  initial: {
    publicTitle: string | null;
    roleFamily: string | null;
    industry: string | null;
    clientRegion: string | null;
    listed: boolean;
  };
  roleFamilies: { value: string; label: string }[];
  clientRegions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicTitle, setPublicTitle] = useState(initial.publicTitle ?? suggestedTitle);
  const [roleFamily, setRoleFamily] = useState(initial.roleFamily ?? "");
  const [industry, setIndustry] = useState(initial.industry ?? "");
  const [clientRegion, setClientRegion] = useState(initial.clientRegion ?? "");

  async function save(listed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/openings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdId,
          listed,
          publicTitle,
          roleFamily: roleFamily || null,
          industry: industry || null,
          clientRegion: clientRegion || null,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Save failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;
  const selectClass =
    "rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <div className="mt-3 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          List publicly on /openings
        </h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            initial.listed ? "bg-brand-soft text-brand" : "bg-line text-ink-soft"
          }`}
        >
          {initial.listed ? "listed" : "not listed"}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        The board shows only the public title, taxonomy, rate band and hours — never the
        employer, the description, or the must-haves. Check the title for client names
        before publishing.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-xs font-medium text-ink-soft">
          Public title
          <input
            type="text"
            value={publicTitle}
            onChange={(e) => setPublicTitle(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Role family
          <select
            value={roleFamily}
            onChange={(e) => setRoleFamily(e.target.value)}
            className={`mt-1 w-full ${selectClass}`}
          >
            <option value="">—</option>
            {roleFamilies.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Client region
          <select
            value={clientRegion}
            onChange={(e) => setClientRegion(e.target.value)}
            className={`mt-1 w-full ${selectClass}`}
          >
            <option value="">—</option>
            {clientRegions.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 text-xs font-medium text-ink-soft">
          Industry (shown as typed)
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            maxLength={80}
            placeholder="e.g. US retail"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {error && <span className="w-full text-xs text-ember">{error}</span>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => save(true)}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0"
        >
          {disabled ? "Saving…" : initial.listed ? "Save changes" : "Publish opening"}
        </button>
        {initial.listed && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => save(false)}
            className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
          >
            Unlist
          </button>
        )}
      </div>
    </div>
  );
}
