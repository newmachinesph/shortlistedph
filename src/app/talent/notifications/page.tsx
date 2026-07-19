const notifications: { text: string; when: string; unread: boolean }[] = [
  { text: "Agreement with Harbor Dental Group is active — starts Aug 3.", when: "Today", unread: true },
  { text: "You were shortlisted #1 of 5 for a US healthcare role.", when: "Jul 16", unread: true },
  { text: "Harbor Dental Group requested a connection.", when: "Jul 16", unread: false },
  { text: "Your interview is confirmed — Jul 17, 8:00 PM PHT.", when: "Jul 16", unread: false },
  { text: "Profile matched a telehealth job — not shortlisted (rate band).", when: "Jul 15", unread: false },
  { text: "An employer viewed your snapshot profile.", when: "Jul 12", unread: false },
];

export default function TalentNotificationsPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Everything your profile has done without you lifting a finger.
          </p>
        </div>
        <button className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          Mark all read
        </button>
      </div>

      <section className="mt-7 rounded-2xl border border-line bg-white">
        {notifications.map((n, i) => (
          <div
            key={n.text}
            className={`flex items-start gap-3 px-6 py-4 ${
              i < notifications.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-brand" : "bg-transparent"}`}
            />
            <div className="min-w-0 flex-1">
              <p className={n.unread ? "font-medium text-ink" : "text-ink-soft"}>{n.text}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{n.when}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
