import type { Metadata } from "next";
import { Star } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";

export const metadata: Metadata = { title: "Ratings", ...NOINDEX };

// ponytail: no query — nothing in the app writes a Rating yet, so this page is
// an empty state by construction. Add the read when rating gets a write path.
export default async function EmployerRatingsPage() {
  await requirePageUser("employer");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ratings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        How the talent you hired rates you — payment punctuality, communication, scope respect.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
        <Star className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
        <h2 className="font-display mt-4 text-lg font-semibold text-ink">No ratings yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          A rating becomes possible only after an agreement runs to a confirmed outcome. Rating is
          not open yet — when it is, both sides rate blind and the results release once both have
          rated, or automatically after 14 days.
        </p>
      </div>
    </>
  );
}
