import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users as UsersIcon } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { Avatar } from "@/components/avatar";
import { listUsers } from "@/lib/admin";
import { EmployerCredits, UserStatusActions } from "./actions";

export const metadata: Metadata = { title: "Admin · Users", ...NOINDEX };

const statusChip: Record<string, string> = {
  active: "bg-brand-soft text-brand",
  suspended: "bg-ember-soft text-ember",
  banned: "bg-line text-ink-soft",
};

const ROLE_TABS: { label: string; value?: string }[] = [
  { label: "All" },
  { label: "Talent", value: "talent" },
  { label: "Employers", value: "employer" },
  { label: "Interviewers", value: "interviewer" },
  { label: "Admins", value: "admin" },
];

const STATUS_CHIPS: { label: string; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Banned", value: "banned" },
];

function subtitle(u: Awaited<ReturnType<typeof listUsers>>["users"][number]): string {
  if (u.employer) {
    const bits = [u.employer.companyName];
    if (u.employer.location) bits.push(u.employer.location);
    bits.push(`${u.employer.credits} credit${u.employer.credits === 1 ? "" : "s"}`);
    return bits.join(" · ");
  }
  if (u.interviewer) {
    const bits = [`interviewer ${u.interviewer.status}`, `$${u.interviewer.rateUsd}/interview`];
    return bits.join(" · ");
  }
  if (u.talentProfile) {
    const bits = [u.talentProfile.headline ?? "No headline"];
    if (u.talentProfile.city) bits.push(u.talentProfile.city);
    if (u.talentProfile.rateUsd != null) bits.push(`$${u.talentProfile.rateUsd}/hr`);
    bits.push(u.talentProfile.publishedAt ? "published" : "unpublished");
    if (u.talentProfile.verifiedTier === "id_verified") bits.push("ID verified");
    // Leads the rest of the line: a resume that tried to instruct the extractor
    // is the one thing here an admin should act on. See lib/resume-guard.ts.
    if (u.talentProfile.flags.length > 0) {
      return [`⚠ ${u.talentProfile.flags.join(", ")}`, ...bits].join(" · ");
    }
    return bits.join(" · ");
  }
  return "No profile yet";
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q } = params;
  const { users, total, page: current, pageCount, roleCounts, role, status } = await listUsers({
    q,
    role: params.role,
    status: params.status,
    page: Number(params.page) || 1,
  });

  const allCount = Object.values(roleCounts).reduce((sum, n) => sum + n, 0);

  // One builder for every link on the page. Page is only carried when passed,
  // so switching tab, status, or search always lands back on page 1.
  const href = (next: { role?: string; status?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (next.role) sp.set("role", next.role);
    if (next.status) sp.set("status", next.status);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const qs = sp.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Users</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {total} account{total === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}. Newest first.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {ROLE_TABS.map((t) => {
          const active = role === t.value || (!role && !t.value);
          const count = t.value ? (roleCounts[t.value] ?? 0) : allCount;
          return (
            <Link
              key={t.label}
              href={href({ role: t.value, status })}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
              }`}
            >
              {t.label} <span className={active ? "text-white/70" : "text-ink-faint"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">Status:</span>
        {STATUS_CHIPS.map((s) => {
          const active = status === s.value;
          return (
            <Link
              key={s.value}
              // Clicking the active chip clears the filter.
              href={href({ role, status: active ? undefined : s.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <form className="mt-4 flex gap-2" action="/admin/users">
        {/* Searching keeps the current tab and status filter, resets the page. */}
        {role && <input type="hidden" name="role" value={role} />}
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            className="min-h-11 w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-base text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Search
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UsersIcon className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <p className="mt-3 text-sm text-ink-soft">
              {q || role || status ? "No accounts match this view." : "No accounts yet."}
            </p>
          </div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${
                i < users.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <Avatar name={u.employer?.companyName ?? u.name} image={u.image} size="md" />
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-ink">
                  {u.employer?.companyName ?? u.name}{" "}
                  <span className="text-xs font-normal text-ink-faint">{u.role}</span>
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {u.email} · {subtitle(u)} · joined{" "}
                  {u.createdAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {/* Chip travels with the buttons so status and its levers never split across rows. */}
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    statusChip[u.status] ?? statusChip.active
                  }`}
                >
                  {u.status}
                </span>
                <UserStatusActions
                  userId={u.id}
                  status={u.status}
                  published={u.talentProfile?.publishedAt != null}
                />
              </div>
              {u.employer && (
                <EmployerCredits
                  userId={u.id}
                  credits={u.employer.credits}
                  interviewCredits={u.employer.interviewCredits}
                />
              )}
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={href({ role, status, page: current - 1 })} className="text-brand hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-faint">
            Page {current} of {pageCount}
          </span>
          {current < pageCount ? (
            <Link href={href({ role, status, page: current + 1 })} className="text-brand hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </>
  );
}
