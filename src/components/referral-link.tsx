"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper sm:min-h-0 sm:w-auto sm:bg-transparent sm:text-xs"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function ReferralLink({
  code,
  base,
  /** Pre-formatted server-side — REFERRAL_REWARD lives in a server-only module. */
  bounty,
}: {
  code: string;
  base: string;
  bounty: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState("");

  const link = `${base}/r/${code}`;
  const cleanTag = tag.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const campaign = cleanTag ? `${link}?s=${cleanTag}` : link;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api("/api/referral", { method: "PATCH", body: JSON.stringify({ code: draft }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that code");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          Your link
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Send this to a company that needs to hire. {bounty} when they buy their first shortlist,
          once per company. Referring a jobseeker earns nothing.
        </p>
        {/* break-all on phones: an affiliate needs to read the whole code before
            sharing it, and a truncated link looks like the wrong link. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-4 py-3">
          <span className="w-full min-w-0 break-all text-sm text-ink sm:w-auto sm:flex-1 sm:truncate">
            {link}
          </span>
          <CopyButton value={link} />
        </div>
      </div>

      <div>
        <label htmlFor="ref-code" className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          Custom code
        </label>
        {/* The prefix owns its own line on a phone — squeezed onto one row it
            leaves the input too narrow to read the code being typed. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="w-full break-all text-sm text-ink-faint sm:w-auto">
            {base.replace(/^https?:\/\//, "")}/r/
          </span>
          <input
            id="ref-code"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase())}
            spellCheck={false}
            className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand sm:min-h-0 sm:w-auto sm:flex-1 sm:text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || draft === code || draft.length < 3}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:w-auto"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          3–32 characters: lowercase letters, numbers and dashes. Changing it breaks links you already shared.
        </p>
        {error && <p className="mt-2 text-xs text-ember">{error}</p>}
      </div>

      <div>
        <label htmlFor="ref-tag" className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          Campaign link
        </label>
        <p className="mt-1 text-xs text-ink-faint">
          Tag a link to see which post or group the companies came from. One code, separate
          numbers.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="ref-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="facebook-group"
            className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand sm:min-h-0 sm:text-sm"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-4 py-3">
          <span className="w-full min-w-0 break-all text-sm text-ink sm:w-auto sm:flex-1 sm:truncate">
            {campaign}
          </span>
          <CopyButton value={campaign} />
        </div>
      </div>
    </div>
  );
}
