import Link from "next/link";
import { SearchX } from "lucide-react";
import { NOINDEX } from "@/lib/site";

export const metadata = { title: "Not found", ...NOINDEX };

/**
 * Catches both a bad URL and every `notFound()` in the app — including the
 * ones the workspace pages throw for a row that belongs to someone else. So
 * the copy must never imply the thing exists but is out of reach.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
          <SearchX className="h-5 w-5 text-brand" strokeWidth={1.75} />
        </span>
        <h1 className="font-display mt-4 text-lg font-semibold text-ink">Nothing here</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          This page does not exist, or it is not yours to see. Check the link and try again.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Back to shortlisted.ph
        </Link>
      </div>
    </div>
  );
}
