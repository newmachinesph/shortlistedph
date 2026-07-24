import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, EyeOff, FileText, Radar } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { ButtonLink } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { getOpening } from "@/lib/openings";
import { clientRegionLabel, roleFamilyLabel } from "@/lib/openings-taxonomy";
import { SITE_URL } from "@/lib/site";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const o = await getOpening(id);
  if (!o) return { title: "Role not found · shortlisted.ph" };
  return {
    title: `${o.title} · Open role · shortlisted.ph`,
    description: `An anonymized open role for ${roleFamilyLabel(o.roleFamily) ?? "remote talent"}. You don't apply — your profile is matched automatically.`,
    alternates: { canonical: `${SITE_URL}/openings/${o.id}` },
  };
}

export default async function OpeningDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await getOpening(id);
  if (!o) notFound();

  const facts: [string, string | null][] = [
    ["Rate band", o.rateBand],
    ["Hours", o.hoursPerWeek ? `${o.hoursPerWeek} per week` : null],
    ["Overlap", o.overlap],
    ["Client", clientRegionLabel(o.clientRegion)],
    ["Industry", o.industry],
  ];

  return (
    <PublicPage>
      <section className="mx-auto w-full max-w-3xl px-5 pt-12 pb-20 sm:px-8 sm:pt-16">
        <Link
          href="/openings"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> All open roles
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {o.roleFamily && <Tag>{roleFamilyLabel(o.roleFamily)}</Tag>}
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <span className={`h-1.5 w-1.5 rounded-full ${o.isMatching ? "bg-brand" : "bg-ink-faint"}`} />
            {o.isMatching ? "matching now" : "closed"}
          </span>
        </div>

        <h1 className="font-display mt-4 font-semibold leading-[1.1] tracking-tight text-ink [font-size:var(--text-h2)]">
          {o.title}
        </h1>

        {/* Fact grid — everything a candidate is allowed to see */}
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-6 sm:grid-cols-3">
          {facts
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
                  {label}
                </dt>
                <dd className="mt-1 font-medium text-ink">{value}</dd>
              </div>
            ))}
        </dl>

        {/* The honest panel — why there's no apply button */}
        <div className="mt-8 [border-radius:var(--radius-lg)] bg-brand-soft p-6 sm:p-8">
          <EyeOff className="h-5 w-5 text-brand" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-xl font-semibold tracking-tight text-ink">
            There&rsquo;s no apply button — on purpose.
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            You&rsquo;re seeing an anonymized slice of a real role. The full job description stays
            hidden, so no one can tailor a resume to it — which is the whole reason the matching
            here is worth trusting. Our engine reads your standing profile against this role and
            every other one, and if you&rsquo;re a strong match the employer asks to talk. You
            decide whether to say yes, and only then do you see the full brief.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/onboarding" variant="solid" size="md">
              Upload your resume <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/why-it-works" variant="outline" size="md">
              How the ranking works
            </ButtonLink>
          </div>
        </div>

        <Link
          href="/resume-template"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          <FileText className="h-4 w-4" /> What a profile that ranks well looks like
        </Link>
      </section>
    </PublicPage>
  );
}
