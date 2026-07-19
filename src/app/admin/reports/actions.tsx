"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "none" | "suspend" | "ban";

const ACTIONS: { value: Action; label: string }[] = [
  { value: "none", label: "No action" },
  { value: "suspend", label: "Suspend" },
  { value: "ban", label: "Ban" },
];

export function ReportActions({
  reportId,
  targetName,
  targetStatus,
}: {
  reportId: string;
  targetName: string;
  targetStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolution, setResolution] = useState("");
  const [action, setAction] = useState<Action>("none");
  const [confirming, setConfirming] = useState<"resolved" | "dismissed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(status: "resolved" | "dismissed") {
    if (!resolution.trim()) {
      setError("Write a resolution note first — it is the record of why.");
      return;
    }
    // Closing a report is reversible on paper; suspending someone is not what
    // you want to discover you did by mis-clicking.
    if (action !== "none" && confirming !== status) {
      setConfirming(status);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: resolution.trim(), action }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Update failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const disabled = busy || pending;
  const alreadyInactive = targetStatus !== "active";

  return (
    <div className="mt-4 border-t border-line pt-4">
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        rows={2}
        placeholder="Resolution note — what you decided and why."
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">Action on {targetName}:</span>
        {ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              setAction(a.value);
              setConfirming(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
              action === a.value
                ? a.value === "none"
                  ? "bg-paper text-ink ring-line"
                  : "bg-ember-soft text-ember ring-ember/30"
                : "text-ink-soft ring-line hover:bg-paper"
            }`}
          >
            {a.label}
          </button>
        ))}
        {alreadyInactive && action !== "none" && (
          <span className="text-xs text-ink-faint">Already {targetStatus}</span>
        )}
      </div>

      {confirming && (
        <p className="mt-3 text-xs text-ember">
          This will {action} {targetName}, end their sessions, unpublish any talent profile, and tell
          anyone mid-conversation with them. Press {confirming === "resolved" ? "Resolve" : "Dismiss"}{" "}
          again to confirm.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => decide("resolved")}
          className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {confirming === "resolved" ? "Confirm resolve" : "Resolve"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => decide("dismissed")}
          className="rounded-xl px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50"
        >
          {confirming === "dismissed" ? "Confirm dismiss" : "Dismiss"}
        </button>
        {error && <span className="text-xs text-ember">{error}</span>}
        <span className="ml-auto self-center text-xs text-ink-faint">
          Records preserved for lawful requests
        </span>
      </div>
    </div>
  );
}
