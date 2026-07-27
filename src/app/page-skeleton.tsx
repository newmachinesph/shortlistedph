/**
 * The pending shape every workspace `loading.tsx` renders. Geometry only, on
 * purpose: a skeleton that mimics the real content is a second layout to keep
 * in sync with the page it stands in for.
 *
 * Not a route file — Next only routes page/layout/loading/error/not-found, so
 * this colocates safely and keeps the three boundaries down to one line each.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-56 max-w-full rounded-lg bg-line" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-lg bg-line/60" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 border border-line bg-[var(--color-surface)] [border-radius:var(--radius-card)]"
          />
        ))}
      </div>
    </div>
  );
}
