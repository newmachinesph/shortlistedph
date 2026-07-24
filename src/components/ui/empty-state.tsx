import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared zero-result / empty state. Centered icon, message, and an optional
 * action, so a filtered board with no matches or an empty list reads as
 * intentional rather than broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
          <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
        </span>
      )}
      <h3 className="font-display mt-4 text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
