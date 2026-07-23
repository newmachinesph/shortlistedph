"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

const CONTEXTS = [
  { value: "connection", label: "A connection" },
  { value: "interview", label: "An interview" },
  { value: "message", label: "A message" },
  { value: "other", label: "Something else" },
];

type Props = {
  /** People the reporter has actually connected with — empty list hides the picker. */
  counterparts: { id: string; label: string }[];
  detailPlaceholder: string;
};

const fieldCls =
  "min-h-[44px] w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink focus:border-brand focus:outline-none";

export function ReportForm({ counterparts, detailPlaceholder }: Props) {
  const [againstId, setAgainstId] = useState("");
  const [context, setContext] = useState("other");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
        <Check className="h-4 w-4" strokeWidth={1.75} /> Report filed — our team reviews within 24h.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (subject.trim().length === 0) {
      setError("Add a short subject line.");
      return;
    }
    if (detail.trim().length < 20) {
      setError("Tell us what happened in at least 20 characters.");
      return;
    }
    setStatus("sending");
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          context,
          subject: subject.trim(),
          detail: detail.trim(),
          ...(againstId ? { againstId } : {}),
        }),
      });
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file the report.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      {counterparts.length > 0 && (
        <div>
          <label htmlFor="report-against" className="block text-sm text-ink-soft">
            Who is this about? (optional)
          </label>
          <select
            id="report-against"
            value={againstId}
            onChange={(e) => setAgainstId(e.target.value)}
            className={`${fieldCls} mt-1.5`}
          >
            <option value="">Not on shortlisted.ph / not sure</option>
            {counterparts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="report-context" className="block text-sm text-ink-soft">
          Where did it happen?
        </label>
        <select
          id="report-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className={`${fieldCls} mt-1.5`}
        >
          {CONTEXTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="report-subject" className="block text-sm text-ink-soft">
          Subject
        </label>
        <input
          id="report-subject"
          type="text"
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="One line summing it up"
          className={`${fieldCls} mt-1.5`}
        />
      </div>

      <div>
        <label htmlFor="report-detail" className="block text-sm text-ink-soft">
          What happened?
        </label>
        <textarea
          id="report-detail"
          rows={4}
          maxLength={2000}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={detailPlaceholder}
          className={`${fieldCls} mt-1.5 py-2.5`}
        />
      </div>

      {error && <p className="text-sm text-ember">{error}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "sending" ? "Filing…" : "File report"}
      </button>
    </form>
  );
}
