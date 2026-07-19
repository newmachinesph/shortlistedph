import type { Metadata } from "next";
import Link from "next/link";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";
import { listNotifications, relTime, renderNotification } from "@/lib/notify";
import { MarkAllRead } from "@/components/notif-mark-all-read";

export const metadata: Metadata = { title: "Notifications", ...NOINDEX };

export default async function TalentNotificationsPage() {
  const user = await requirePageUser("talent");
  const { rows, unread } = await listNotifications(user.id);

  // Timestamps are formatted here so the server and the client render the same
  // string. A relative time computed during client render drifts and mismatches.
  const now = new Date();
  const items = rows.map((n) => ({
    id: n.id,
    unread: n.readAt === null,
    when: relTime(n.createdAt, now),
    ...renderNotification(n.type, n.payload, "talent"),
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything your profile has done without you lifting a finger.
          </p>
        </div>
        <MarkAllRead unread={unread} />
      </div>

      <section className="mt-7 rounded-2xl border border-line bg-white">
        {items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-soft">
            Nothing yet. Shortlists, connection requests, and agreement updates land here.
          </p>
        ) : (
          items.map((n, i) => {
            const row = (
              <>
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-brand" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={n.unread ? "font-medium text-ink" : "text-ink-soft"}>{n.text}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{n.when}</p>
                </div>
              </>
            );
            const className = `flex items-start gap-3 px-6 py-4 ${
              i < items.length - 1 ? "border-b border-line" : ""
            }`;

            return n.href ? (
              <Link key={n.id} href={n.href} className={`${className} transition-colors hover:bg-paper`}>
                {row}
              </Link>
            ) : (
              <div key={n.id} className={className}>
                {row}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
