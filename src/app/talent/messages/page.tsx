import { Send } from "lucide-react";

const thread: { at: string; from: "me" | "them"; text: string }[] = [
  {
    at: "Jul 16, 9:14 AM",
    from: "them",
    text: "Hi Kristine! We connected through shortlisted.ph — your dental VA background is exactly what we need. Are you open to a quick interview this week? How about Friday, 8pm PHT / 7am CDT?",
  },
  {
    at: "Jul 16, 9:26 AM",
    from: "me",
    text: "Hi Dr. Chen, yes! Friday 8pm PHT works great for me — I'll block my calendar.",
  },
  {
    at: "Jul 17, 8:47 PM",
    from: "them",
    text: "That was a great conversation — the team loved your Dentrix experience and how you handle insurance verification. I'd like to offer you the role: Medical VA, $9/hr, 40h/week, starting Aug 3.",
  },
  {
    at: "Jul 17, 8:55 PM",
    from: "me",
    text: "Thank you so much — I'd love to accept! Looking forward to getting started.",
  },
  {
    at: "Jul 18, 11:02 AM",
    from: "them",
    text: "Agreement signed on both ends — welcome aboard, Kristine!",
  },
  {
    at: "Jul 18, 11:06 AM",
    from: "me",
    text: "Perfect — see you Monday!",
  },
];

export default function TalentMessagesPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Conversations only open after you accept a connection.
      </p>

      <div className="mt-7 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[18rem_1fr]">
        <div className="min-h-0 overflow-y-auto border-line lg:border-r">
          <p className="px-5 pt-5 pb-3 text-xs font-medium uppercase tracking-wider text-ink-faint">
            Conversations
          </p>
          <button className="flex w-full items-start gap-3 bg-brand-soft px-5 py-3.5 text-left">
            <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-semibold text-brand">
              HD
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">Harbor Dental Group</span>
              <span className="block truncate text-xs text-ink-soft">Perfect — see you Monday!</span>
            </span>
          </button>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <span className="font-display flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft font-semibold text-brand">
              HD
            </span>
            <div>
              <p className="text-sm font-medium text-ink">Harbor Dental Group</p>
              <p className="text-xs text-ink-faint">Dr. Sarah Chen · Austin, TX</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {thread.map((m) => (
              <div key={m.at} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-sm">
                  <p
                    className={
                      m.from === "me"
                        ? "rounded-2xl bg-brand px-4 py-2.5 text-sm text-white"
                        : "rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink"
                    }
                  >
                    {m.text}
                  </p>
                  <p className={`mt-1 text-[11px] text-ink-faint ${m.from === "me" ? "text-right" : "text-left"}`}>
                    {m.at}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-line px-6 py-4">
            <input
              disabled
              placeholder="Message Harbor Dental Group…"
              className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint"
            />
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
