"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export type SearchResult = { id: string; label: string; sub: string | null; href: string };

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

function parseResults(data: unknown): SearchResult[] {
  // Our own API, but still a boundary — keep only well-shaped rows.
  if (!data || typeof data !== "object") return [];
  const rows = (data as { results?: unknown }).results;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r): r is SearchResult =>
      !!r &&
      typeof r === "object" &&
      typeof (r as SearchResult).id === "string" &&
      typeof (r as SearchResult).label === "string" &&
      typeof (r as SearchResult).href === "string",
  );
}

export function WorkspaceSearch({ role }: { role: "employer" | "talent" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const query = q.trim();
    // Below the floor there is nothing to fetch and nothing to clear: the
    // panel's own condition already hides stale results, so this returns
    // instead of setting state synchronously inside the effect.
    if (query.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        setResults(parseResults(await res.json()));
        setOpen(true);
      } catch {
        // Aborted by a newer keystroke or offline — nothing to show.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return (
    <div
      className="relative min-w-0 max-w-md flex-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (q.trim().length >= MIN_QUERY) setOpen(true);
        }}
        aria-label="Search workspace"
        placeholder={role === "employer" ? "Search candidates, job descriptions…" : "Search agreements, messages…"}
        className="w-full rounded-xl border border-line bg-white py-2 pl-10 pr-3 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:pr-16 sm:text-sm"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:block">
        Ctrl K
      </kbd>

      {open && q.trim().length >= MIN_QUERY && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-white py-1.5 shadow-lg shadow-ink/5">
          {results.length === 0 ? (
            <p className="px-4 py-2.5 text-sm text-ink-faint">No matches</p>
          ) : (
            results.map((r) => (
              <Link
                key={`${r.href}-${r.id}`}
                href={r.href}
                onClick={() => setOpen(false)}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
              >
                <span className="truncate font-medium text-ink">{r.label}</span>
                {r.sub && <span className="shrink-0 text-xs text-ink-faint">{r.sub}</span>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
