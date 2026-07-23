import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/queries";
import { initials } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { openThreadWhere, stamp } from "@/lib/notify";
import { MessageSend } from "@/components/messages-send";

export const metadata: Metadata = { title: "Messages", ...NOINDEX };

export default async function TalentMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await requirePageUser("talent");
  const { c } = await searchParams;

  // openThreadWhere carries both the participant filter and the consent gate,
  // so this can only ever return conversations this candidate agreed to open.
  const conversations = await db.connection.findMany({
    where: openThreadWhere({ side: "talent", userId: user.id }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slateEntry: {
        select: {
          snapshot: {
            select: {
              jd: {
                select: {
                  title: true,
                  employer: { select: { companyName: true, location: true, contactName: true } },
                },
              },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });

  // Fall back to the newest thread rather than trusting ?c= — an id that is not
  // in this list was never the candidate's to read.
  const active = conversations.find((conv) => conv.id === c) ?? conversations[0] ?? null;

  const messages = active
    ? await db.message.findMany({
        where: { connectionId: active.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, senderId: true, body: true, createdAt: true },
      })
    : [];

  const activeJd = active?.slateEntry.snapshot.jd;
  const activeCompany = activeJd?.employer.companyName ?? "";
  const activeSub = [activeJd?.employer.contactName, activeJd?.employer.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8rem)]">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Conversations only open after you accept a connection.
      </p>

      {conversations.length === 0 ? (
        <div className="mt-7 flex flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-white px-6 py-16 text-center">
          <MessageSquare className="h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <p className="mt-4 font-medium text-ink">No conversations yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            When an employer asks to be introduced and you accept, the thread opens here. Nobody can
            message you before that.
          </p>
          <Link
            href="/talent/connections"
            className="mt-5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
          >
            Review connection requests
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[18rem_1fr]">
          <div className="max-h-64 min-h-0 overflow-y-auto border-b border-line lg:max-h-none lg:border-b-0 lg:border-r">
            <p className="px-5 pt-5 pb-3 text-xs font-medium uppercase tracking-wider text-ink-faint">
              Conversations
            </p>
            {conversations.map((conv) => {
              const company = conv.slateEntry.snapshot.jd.employer.companyName;
              const isActive = conv.id === active?.id;
              return (
                <Link
                  key={conv.id}
                  href={`/talent/messages?c=${conv.id}`}
                  className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors ${
                    isActive ? "bg-brand-soft" : "hover:bg-paper"
                  }`}
                >
                  <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-semibold text-brand">
                    {initials(company)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{company}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {conv.messages[0]?.body ?? "No messages yet"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-6">
              <Avatar name={activeCompany} size="md" />
              <div>
                <p className="text-sm font-medium text-ink">{activeCompany}</p>
                <p className="text-xs text-ink-faint">{activeSub || activeJd?.title}</p>
              </div>
            </div>

            <div className="min-h-[50vh] flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6 lg:min-h-0">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">
                  No messages yet. Say hello.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="min-w-0 max-w-[85%] sm:max-w-sm">
                        <p
                          className={
                            mine
                              ? "rounded-2xl bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white"
                              : "rounded-2xl border border-line bg-white px-4 py-2.5 text-sm whitespace-pre-wrap text-ink"
                          }
                        >
                          {m.body}
                        </p>
                        <p
                          className={`mt-1 text-[11px] text-ink-faint ${mine ? "text-right" : "text-left"}`}
                        >
                          {stamp(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {active && (
              <MessageSend connectionId={active.id} placeholder={`Message ${activeCompany}…`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
