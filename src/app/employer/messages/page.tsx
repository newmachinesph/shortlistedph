import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { initials } from "@/lib/format";
import { openThreadWhere, stamp } from "@/lib/notify";
import { MessageSend } from "@/components/messages-send";

export const metadata: Metadata = { title: "Messages", ...NOINDEX };

export default async function EmployerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const { c } = await searchParams;

  // Scoped to this employer account and to consented connections only, so a
  // candidate who declined never appears here at all.
  const conversations = await db.connection.findMany({
    where: openThreadWhere({ side: "employer", employerId: employer.id }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slateEntry: {
        select: {
          snapshot: {
            select: {
              jd: { select: { title: true } },
              profile: { select: { city: true, user: { select: { name: true } } } },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });

  // ?c= is a hint, not an authority — anything not in the scoped list is ignored.
  const active = conversations.find((conv) => conv.id === c) ?? conversations[0] ?? null;

  const messages = active
    ? await db.message.findMany({
        where: { connectionId: active.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, senderId: true, body: true, createdAt: true },
      })
    : [];

  const activeSnapshot = active?.slateEntry.snapshot;
  const activeName = activeSnapshot?.profile.user.name ?? "";
  const activeSub = [activeSnapshot?.jd.title, activeSnapshot?.profile.city]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8rem)]">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Conversations only open once a candidate has accepted a connection request.
      </p>

      {conversations.length === 0 ? (
        <div className="mt-7 flex flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
          <MessageSquare className="h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <p className="mt-4 font-medium text-ink">No conversations yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            Request a connection from a shortlist. Once the candidate accepts, the thread opens
            here. Candidates who decline stay unreachable.
          </p>
          <Link
            href="/employer/connections"
            className="mt-5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
          >
            View connection requests
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[18rem_1fr]">
          <div className="max-h-64 min-h-0 overflow-y-auto border-b border-line lg:max-h-none lg:border-b-0 lg:border-r">
            {conversations.map((conv) => {
              const name = conv.slateEntry.snapshot.profile.user.name;
              const isActive = conv.id === active?.id;
              return (
                <Link
                  key={conv.id}
                  href={`/employer/messages?c=${conv.id}`}
                  className={`block border-b border-line px-5 py-4 transition-colors last:border-b-0 ${
                    isActive ? "bg-brand-soft/60" : "hover:bg-paper"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">
                      {initials(name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{name}</p>
                      <p className="truncate text-xs text-ink-faint">
                        {conv.slateEntry.snapshot.jd.title}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs text-ink-soft">
                    {conv.messages[0]?.body ?? "No messages yet"}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-line px-4 py-4 sm:px-6">
              <p className="font-medium text-ink">{activeName}</p>
              <p className="text-xs text-ink-faint">{activeSub}</p>
            </div>

            <div className="min-h-[50vh] flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6 lg:min-h-0">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">
                  No messages yet. Open with the specifics — role, hours, and what the first week
                  looks like.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="min-w-0 max-w-[85%] sm:max-w-md">
                        <div
                          className={
                            mine
                              ? "rounded-2xl bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white"
                              : "rounded-2xl border border-line bg-white px-4 py-2.5 text-sm whitespace-pre-wrap text-ink"
                          }
                        >
                          {m.body}
                        </div>
                        <p className={`mt-1 text-[11px] text-ink-faint ${mine ? "text-right" : ""}`}>
                          {stamp(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {active && (
              <MessageSend
                connectionId={active.id}
                placeholder={`Message ${activeName}…`}
                withLabel
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
