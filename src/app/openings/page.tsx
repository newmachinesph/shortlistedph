import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ListingRow } from "@/components/ui/listing-row";
import { listOpenings } from "@/lib/openings";
import {
  CLIENT_REGIONS,
  ROLE_FAMILIES,
  clientRegionLabel,
  roleFamilyLabel,
} from "@/lib/openings-taxonomy";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Open roles · shortlisted.ph",
  description:
    "Live demand from companies hiring Philippine remote talent. You don't apply — upload your resume once and your profile is matched against every role automatically.",
  alternates: { canonical: `${SITE_URL}/openings` },
};

// The board is demand data that changes as employers post and admins approve;
// re-read every 10 minutes rather than per request.
export const revalidate = 600;

type Search = { role?: string; region?: string };

/** Build a board URL with one filter toggled — off if it's already the active value. */
function toggle(current: Search, key: keyof Search, value: string): string {
  const next = { ...current, [key]: current[key] === value ? undefined : value };
  const qs = new URLSearchParams(
    Object.entries(next).filter(([, v]) => v) as [string, string][],
  ).toString();
  return qs ? `/openings?${qs}` : "/openings";
}

export default async function OpeningsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const openings = await listOpenings({
    roleFamily: params.role,
    clientRegion: params.region,
  });

  return (
    <PublicPage>
      {/* Hero — states plainly this is not a job board */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-ember">
          <Radar className="h-3.5 w-3.5" strokeWidth={2} />
          Live demand · not a job board
        </p>
        <h1 className="font-display mt-5 max-w-3xl font-semibold leading-[1.05] tracking-tight text-ink [font-size:var(--text-h1)]">
          The roles being filled right now.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Real openings from companies hiring Filipino remote professionals — anonymized, because
          you never see the job description here. There&rsquo;s nothing to apply to and nothing to
          tailor. Upload your resume once and every one of these is matched against you
          automatically.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <ButtonLink href="/onboarding" variant="solid">
            Upload your resume, get matched <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <Link
            href="/why-it-works"
            className="text-sm font-medium text-brand hover:underline"
          >
            How matching works
          </Link>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 border-y border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl space-y-3 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              Role
            </span>
            {ROLE_FAMILIES.map((r) => (
              <Chip key={r.value} href={toggle(params, "role", r.value)} active={params.role === r.value}>
                {r.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              Client
            </span>
            {CLIENT_REGIONS.map((r) => (
              <Chip key={r.value} href={toggle(params, "region", r.value)} active={params.region === r.value}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Listing */}
      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {openings.length === 0 ? (
          <EmptyState
            icon={Radar}
            title={
              params.role || params.region
                ? "No open roles match that filter yet"
                : "No roles are listed publicly right now"
            }
            body={
              <>
                The board only shows roles a company has agreed to surface anonymously. Your
                profile is matched against every role, listed here or not — the board is a window,
                not the whole pipeline.
              </>
            }
            action={
              <ButtonLink href="/onboarding" variant="outline" size="md">
                Join the talent pool
              </ButtonLink>
            }
          />
        ) : (
          <>
            <p className="mb-2 text-sm text-ink-faint">
              {openings.length} open role{openings.length === 1 ? "" : "s"}
              {params.role ? ` · ${roleFamilyLabel(params.role)}` : ""}
              {params.region ? ` · ${clientRegionLabel(params.region)}` : ""}
            </p>
            <div className="border-t border-line">
              {openings.map((o) => (
                <ListingRow
                  key={o.id}
                  href={`/openings/${o.id}`}
                  eyebrow={roleFamilyLabel(o.roleFamily) ?? undefined}
                  title={o.title}
                  meta={[clientRegionLabel(o.clientRegion), o.industry].filter(Boolean).join(" · ")}
                  facts={[o.rateBand, o.hoursPerWeek ? `${o.hoursPerWeek} h/wk` : null, o.overlap]
                    .filter(Boolean)
                    .join(" · ")}
                  status={
                    o.isMatching
                      ? { label: "matching now", live: true }
                      : { label: "closed", live: false }
                  }
                  note="Not an application — your profile is matched automatically."
                />
              ))}
            </div>
          </>
        )}
      </section>
    </PublicPage>
  );
}
