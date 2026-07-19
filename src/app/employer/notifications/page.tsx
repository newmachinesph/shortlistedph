import { CheckCheck } from "lucide-react";

const items: { title: string; when: string; unread: boolean }[] = [
  {
    title: "Slate ready for Senior React engineer, product team — free preview available",
    when: "Today",
    unread: true,
  },
  { title: "Agreement with Kristine Bautista was signed by both parties", when: "Jul 18", unread: false },
  { title: "Receipt for $49 unlock — Medical VA slate", when: "Jul 18", unread: false },
  { title: "Connection request sent to Louie Mendoza — awaiting his consent", when: "Jul 18", unread: false },
  { title: "Reminder: rate your engagement with Jerome Dela Cruz", when: "Jul 17", unread: true },
  { title: "Kristine Bautista accepted your connection request", when: "Jul 16", unread: false },
];

export default function EmployerNotificationsPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything that happened across your briefs, connections, and agreements.
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
      </div>

      <div className="mt-7 rounded-2xl border border-line bg-white">
        {items.map((n, i) => (
          <div
            key={n.title}
            className={`flex items-start gap-3 px-6 py-4 ${i < items.length - 1 ? "border-b border-line" : ""}`}
          >
            {n.unread ? (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
            ) : (
              <span className="mt-1.5 h-2 w-2 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className={n.unread ? "font-medium text-ink" : "text-ink-soft"}>{n.title}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{n.when}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
