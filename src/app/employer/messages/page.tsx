import { Send } from "lucide-react";

const conversations = [
  {
    id: "kristine",
    name: "Kristine Bautista",
    sub: "Medical VA · active",
    last: "Perfect — see you Monday!",
    active: true,
  },
  {
    id: "jerome",
    name: "Jerome Dela Cruz",
    sub: "Bookkeeper · Jun 2026",
    last: "Thanks again for the opportunity!",
    active: false,
  },
];

const thread: { from: "me" | "them"; text: string; when: string }[] = [
  {
    from: "them",
    when: "Jul 16, 9:14 AM",
    text: "Hi Dr. Chen! Thank you for connecting — I'm looking forward to learning more about the role.",
  },
  {
    from: "me",
    when: "Jul 16, 9:41 AM",
    text: "Thanks for accepting, Kristine. Could we hop on a call this week? I'm free Friday evening, your time.",
  },
  {
    from: "them",
    when: "Jul 16, 9:50 AM",
    text: "Friday 8pm PHT works great on my end — I'll send a Google Meet link.",
  },
  {
    from: "me",
    when: "Jul 17, 9:05 PM",
    text: "That was a great conversation — you clearly know dental front-desk workflows inside out. I'd like to move forward with an offer.",
  },
  {
    from: "them",
    when: "Jul 17, 9:12 PM",
    text: "That means a lot, thank you! I'd love to move forward too.",
  },
  {
    from: "me",
    when: "Jul 18, 11:20 AM",
    text: "Agreement is signed on my end — $9/hr, 40h/week, starting Aug 3. Sending the e-sign link now.",
  },
  {
    from: "them",
    when: "Jul 18, 11:34 AM",
    text: "Signed on my end too. Perfect — see you Monday!",
  },
];

export default function EmployerMessagesPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Conversations only open once a candidate has accepted a connection request.
      </p>

      <div className="mt-7 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[18rem_1fr]">
        <div className="min-h-0 overflow-y-auto border-b border-line lg:border-b-0 lg:border-r">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`border-b border-line px-5 py-4 last:border-b-0 ${c.active ? "bg-brand-soft/60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">
                  {c.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="truncate text-xs text-ink-faint">{c.sub}</p>
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-ink-soft">{c.last}</p>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-line px-6 py-4">
            <p className="font-medium text-ink">Kristine Bautista</p>
            <p className="text-xs text-ink-faint">Medical VA — Davao City</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {thread.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-md">
                  <div
                    className={
                      m.from === "me"
                        ? "rounded-2xl bg-brand px-4 py-2.5 text-sm text-white"
                        : "rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink"
                    }
                  >
                    {m.text}
                  </div>
                  <p className={`mt-1 text-[11px] text-ink-faint ${m.from === "me" ? "text-right" : ""}`}>
                    {m.when}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 border-t border-line px-6 py-4">
            <input
              disabled
              placeholder="Message Kristine…"
              className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink-faint"
            />
            <button
              disabled
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand/50 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
