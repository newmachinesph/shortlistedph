"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * The join link for one assignment. /apply/interviewer promises interviewers
 * run the call on their own tool, and until this existed there was no field
 * anywhere to share it — a booked interview nobody could attend.
 */
export function MeetingLink({
  interviewId,
  meetingUrl,
}: {
  interviewId: string;
  meetingUrl: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(meetingUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/interviewer/schedule", {
        method: "PATCH",
        body: JSON.stringify({ interviewId, meetingUrl: value }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Link2 className="h-4 w-4 text-ink-soft" strokeWidth={1.75} />
        Meeting link
        {meetingUrl && <Check className="h-4 w-4 text-brand" strokeWidth={2} />}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">
        Zoom, Meet, Whereby — whatever you run the call on. The candidate and the employer both see
        this, so it has to work without you letting them in by hand.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://meet.google.com/…"
          aria-label="Meeting link"
          className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !value.trim()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {meetingUrl ? "Update" : "Save"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
      {!meetingUrl && !error && (
        <p className="mt-1.5 text-xs text-ember">
          Nobody can join this interview until you add a link.
        </p>
      )}
    </div>
  );
}
