import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { listOpenings, requireAdminPage, timeAgo } from "@/lib/admin";
import { CLIENT_REGIONS, ROLE_FAMILIES } from "@/lib/openings-taxonomy";
import { ListPubliclyForm } from "../slates/actions";

export const metadata: Metadata = { title: "Admin · Openings", ...NOINDEX };

type Opening = Awaited<ReturnType<typeof listOpenings>>["listed"][number];

/**
 * One brief, collapsed to a line until an operator opens it. The editor inside
 * is the same component slate review uses — one implementation of "list
 * publicly", so the two surfaces cannot drift apart.
 */
function OpeningRow({ jd }: { jd: Opening }) {
  const listed = jd.listedAt != null;
  const slateId = jd.slates[0]?.id;

  return (
    <details className="group border-b border-line last:border-b-0 open:bg-paper">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 marker:content-none hover:bg-paper sm:px-6">
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate text-sm font-medium text-ink">{jd.publicTitle ?? jd.title}</p>
          <p className="truncate text-xs text-ink-faint">
            {jd.employer.companyName} · {jd.status}
            {jd.publicTitle && jd.publicTitle !== jd.title ? ` · internally “${jd.title}”` : ""}
            {listed ? ` · listed ${timeAgo(jd.listedAt!)}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            listed ? "bg-brand-soft text-brand" : "bg-line text-ink-soft"
          }`}
        >
          {listed ? "listed" : "not listed"}
        </span>
        <span className="text-xs text-brand group-open:hidden">Edit</span>
        <span className="hidden text-xs text-ink-faint group-open:inline">Close</span>
      </summary>
      <div className="px-4 pb-4 sm:px-6">
        {slateId && (
          <Link href={`/admin/slates/${slateId}`} className="text-xs text-brand hover:underline">
            Open slate review →
          </Link>
        )}
        <ListPubliclyForm
          jdId={jd.id}
          suggestedTitle={jd.title}
          initial={{
            publicTitle: jd.publicTitle,
            roleFamily: jd.roleFamily,
            industry: jd.industry,
            clientRegion: jd.clientRegion,
            listed,
          }}
          roleFamilies={ROLE_FAMILIES}
          clientRegions={CLIENT_REGIONS}
        />
      </div>
    </details>
  );
}

export default async function AdminOpenings() {
  await requireAdminPage();
  const { listed, listable } = await listOpenings();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Openings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        What the public /openings board shows. The board fails closed — nothing appears without a
        public title an operator wrote and approved here.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Live on the board
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {listed.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {listed.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Globe className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <p className="mt-3 text-sm text-ink-soft">Nothing is listed publicly.</p>
          </div>
        ) : (
          listed.map((jd) => <OpeningRow key={jd.id} jd={jd} />)
        )}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Published, not listed
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {listable.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {listable.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            Every published brief is already on the board.
          </p>
        ) : (
          listable.map((jd) => <OpeningRow key={jd.id} jd={jd} />)
        )}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        A brief no longer needs a slate to be listed — this is the only place a still-matching or
        failed one can reach the board, and the only place a live listing can be pulled.
      </p>
    </>
  );
}
