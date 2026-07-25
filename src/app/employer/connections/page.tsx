import Link from "next/link";
import { Clock, Mail, Users, X } from "lucide-react";
import { employerOrOnboard, listEmployerConnections, requirePageUser } from "@/lib/queries";
import { Avatar } from "@/components/avatar";
import type { FrozenProfile } from "@/lib/slate";

export default async function EmployerConnectionsPage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const connections = await listEmployerConnections(employer.id);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Connections</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Candidates consent before their contact details are released — a request is an invitation,
        not an entitlement.
      </p>

      {connections.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <Users className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No connections yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Unlock a shortlist, then request a connection with the candidates you want to meet.
          </p>
          <Link
            href="/employer/briefs"
            className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            View your shortlists
          </Link>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {connections.map((c) => {
            const snap = c.slateEntry.snapshot;
            const p = snap.frozenJson as FrozenProfile;
            const consented = c.state === "consented";
            const declined = c.state === "declined";
            const contact = snap.profile.user;

            return (
              <div key={c.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* A declined candidate stays anonymous — the slot simply closed. */}
                    <Avatar name={declined ? "—" : contact.name} size="md" />
                    <div>
                      <h2 className="font-medium text-ink">
                        {declined ? "Candidate declined" : contact.name}
                      </h2>
                      <p className="text-sm text-ink-soft">
                        {p.headline ?? "Candidate"} · for {snap.jd.title}
                      </p>
                    </div>
                  </div>

                  {consented && (
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                      Connected
                    </span>
                  )}
                  {c.state === "requested" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                      <Clock className="h-3 w-3" /> Awaiting their consent
                    </span>
                  )}
                  {declined && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
                      <X className="h-3 w-3" /> Slot reopened
                    </span>
                  )}
                </div>

                {consented && (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-brand-soft px-4 py-3">
                    <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium text-brand">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="break-all">{contact.email}</span>
                    </span>
                    <span className="text-xs text-ink-soft">
                      Take it from here — we don&rsquo;t sit between you.
                    </span>
                  </div>
                )}

                {/* No rating or response-rate score is readable by talent anywhere —
                    the old copy promised a signal that has no read side. */}
                {c.state === "requested" && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                    They can see the role, the pay band, the hours and your company blurb, and will
                    decide from that.
                  </p>
                )}

                {declined && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                    You&rsquo;ll never see a reason, and their identity stays sealed. We keep
                    confirming availability with other matched candidates to refill the slot.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
