import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users as UsersIcon } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { initials } from "@/lib/format";
import { listUsers } from "@/lib/admin";
import { UserStatusActions } from "./actions";

export const metadata: Metadata = { title: "Admin · Users", ...NOINDEX };

const statusChip: Record<string, string> = {
  active: "bg-brand-soft text-brand",
  suspended: "bg-ember-soft text-ember",
  banned: "bg-line text-ink-soft",
};

function subtitle(u: Awaited<ReturnType<typeof listUsers>>["users"][number]): string {
  if (u.employer) {
    const bits = [u.employer.companyName];
    if (u.employer.location) bits.push(u.employer.location);
    bits.push(`${u.employer.credits} credit${u.employer.credits === 1 ? "" : "s"}`);
    return bits.join(" · ");
  }
  if (u.talentProfile) {
    const bits = [u.talentProfile.headline ?? "No headline"];
    if (u.talentProfile.city) bits.push(u.talentProfile.city);
    bits.push(u.talentProfile.publishedAt ? "published" : "unpublished");
    if (u.talentProfile.verifiedTier === "id_verified") bits.push("ID verified");
    return bits.join(" · ");
  }
  return "No profile yet";
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const { users, total, page: current, pageCount } = await listUsers({
    q,
    page: Number(page) || 1,
  });

  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Users</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {total} account{total === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}. Newest first.
      </p>

      <form className="mt-6 flex gap-2" action="/admin/users">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.75}
          />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Search
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UsersIcon className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <p className="mt-3 text-sm text-ink-soft">
              {q ? "No accounts match that search." : "No accounts yet."}
            </p>
          </div>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className={`flex flex-wrap items-center gap-4 px-6 py-4 ${
                i < users.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                {initials(u.employer?.companyName ?? u.name)}
              </span>
              <div className="min-w-0 flex-1">
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
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  statusChip[u.status] ?? statusChip.active
                }`}
              >
                {u.status}
              </span>
              <UserStatusActions userId={u.id} status={u.status} />
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link href={href(current - 1)} className="text-brand hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-faint">
            Page {current} of {pageCount}
          </span>
          {current < pageCount ? (
            <Link href={href(current + 1)} className="text-brand hover:underline">
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
