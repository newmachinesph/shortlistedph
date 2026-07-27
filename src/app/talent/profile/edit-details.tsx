"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/auth-client";
import { ChipList, Field, Select, TextArea, TextInput } from "@/components/onboarding-fields";

type Engagement = {
  /** Absent on a row just added here; the API reads that as "create". */
  id?: string;
  role: string;
  company: string;
  span: string;
  confirmed?: boolean;
};

export type EditableProfile = {
  headline: string | null;
  summary: string | null;
  city: string | null;
  education: string | null;
  englishLevel: string | null;
  tools: string | null;
  certifications: string | null;
  preferredOverlap: string | null;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
};

/**
 * The post-onboarding edit surface. The wizard only ever shows the gaps a
 * resume left open, so once a field was filled — by the parse or by the
 * wizard — there was no way back to it: summary, city, education and links
 * were effectively write-once.
 *
 * One form, one PATCH. Rate and availability are deliberately absent: the rate
 * carries a 30-day lock (/api/talent/rate) and availability is a confirmation,
 * not an edit (the section above it).
 */
export function EditDetails({
  profile,
  skills,
  engagements,
}: {
  profile: EditableProfile;
  skills: { name: string; confirmed: boolean }[];
  engagements: Engagement[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [skillList, setSkillList] = useState<string[]>(() => skills.map((s) => s.name));
  const [skillDraft, setSkillDraft] = useState("");
  const [jobs, setJobs] = useState<Engagement[]>(engagements);
  const [jobDraft, setJobDraft] = useState<Engagement>({ role: "", company: "", span: "" });
  const [education, setEducation] = useState(profile.education ?? "");
  const [englishLevel, setEnglishLevel] = useState(profile.englishLevel ?? "");
  const [tools, setTools] = useState(profile.tools ?? "");
  const [certifications, setCertifications] = useState(profile.certifications ?? "");
  const [preferredOverlap, setPreferredOverlap] = useState(profile.preferredOverlap ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl ?? "");

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  // Mutual evidence, not the talent's alone to delete — the API refuses it too.
  const confirmedSkills = new Set(skills.filter((s) => s.confirmed).map((s) => s.name));

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (!skillList.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillList([...skillList, value].slice(0, 20));
    }
    setSkillDraft("");
  }

  function addJob() {
    if (!jobDraft.role.trim() || !jobDraft.company.trim()) return;
    setJobs([...jobs, { ...jobDraft }].slice(0, 12));
    setJobDraft({ role: "", company: "", span: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      await api("/api/talent/profile", {
        method: "PATCH",
        body: JSON.stringify({
          headline: headline.trim(),
          summary: summary.trim(),
          city: city.trim(),
          skills: skillList,
          engagements: jobs.map(({ id, role, company, span }) => ({ id, role, company, span })),
          education: education.trim(),
          englishLevel: englishLevel || null,
          tools: tools.trim(),
          certifications: certifications.trim(),
          preferredOverlap: preferredOverlap.trim(),
          portfolioUrl: portfolioUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
          githubUrl: githubUrl.trim(),
        }),
      });
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setStatus("idle");
    }
  }

  if (!open) {
    return (
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-6">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Edit your profile
          </h2>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-soft">
            Everything here is matched against every job. Changing it resets your stability count,
            and a published profile is re-indexed on save.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-paper px-5 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} /> Edit details
        </button>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
        Edit your profile
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <Field label="Headline" hint="Role and specialty, one line." htmlFor="edit-headline">
          <TextInput
            id="edit-headline"
            value={headline}
            onChange={setHeadline}
            placeholder="Dental insurance verification specialist"
          />
        </Field>
        <Field label="Summary" hint="Two or three factual sentences." htmlFor="edit-summary">
          <TextArea
            id="edit-summary"
            value={summary}
            onChange={setSummary}
            placeholder="What you do, for whom, and with what tools."
          />
        </Field>
        <Field label="City" htmlFor="edit-city">
          <TextInput id="edit-city" value={city} onChange={setCity} placeholder="Cebu City" />
        </Field>

        <Field
          label="Skills"
          hint="Skills carry more weight than anything else. Confirmed ones can't be removed."
          htmlFor="edit-skill-draft"
        >
          <div className="space-y-3">
            <ChipList
              items={skillList}
              onRemove={(s) => setSkillList(skillList.filter((x) => x !== s))}
              locked={(s) => confirmedSkills.has(s)}
            />
            <div className="flex gap-2">
              <TextInput
                id="edit-skill-draft"
                value={skillDraft}
                onChange={setSkillDraft}
                placeholder="Add a skill"
                onEnter={addSkill}
              />
              <button
                type="button"
                onClick={addSkill}
                aria-label="Add skill"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                <Plus className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </Field>

        <Field
          label="Engagement history"
          hint="Outcome-confirmed roles stay — both sides agreed on how they ended."
          htmlFor="edit-job-role"
        >
          <div className="space-y-3">
            {jobs.length > 0 && (
              <ul className="space-y-2">
                {jobs.map((j, i) => (
                  <li
                    key={`${j.role}-${j.company}-${i}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{j.role}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {j.company}
                        {j.span ? ` · ${j.span}` : ""}
                      </span>
                    </span>
                    {j.confirmed ? (
                      <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">
                        Confirmed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setJobs(jobs.filter((_, x) => x !== i))}
                        className="min-h-[44px] shrink-0 px-1 text-xs font-medium text-ink-faint hover:text-ember"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <TextInput
              id="edit-job-role"
              value={jobDraft.role}
              onChange={(v) => setJobDraft({ ...jobDraft, role: v })}
              placeholder="Role — medical billing specialist"
              onEnter={addJob}
            />
            <TextInput
              id="edit-job-company"
              value={jobDraft.company}
              onChange={(v) => setJobDraft({ ...jobDraft, company: v })}
              placeholder="Company — Bright Smiles Dental"
              onEnter={addJob}
            />
            <TextInput
              id="edit-job-span"
              value={jobDraft.span}
              onChange={(v) => setJobDraft({ ...jobDraft, span: v })}
              placeholder="Span — 2022 - 2025"
              onEnter={addJob}
            />
            <button
              type="button"
              onClick={addJob}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} /> Add this role
            </button>
          </div>
        </Field>

        <Field label="Education" htmlFor="edit-education">
          <TextInput
            id="edit-education"
            value={education}
            onChange={setEducation}
            placeholder="BS Accountancy, University of San Carlos"
          />
        </Field>
        <Field
          label="Tools and software"
          hint="Comma separated. Named tools match better than categories."
          htmlFor="edit-tools"
        >
          <TextInput
            id="edit-tools"
            value={tools}
            onChange={setTools}
            placeholder="Dentrix, QuickBooks Online, Slack"
          />
        </Field>
        <Field label="Certifications" hint="Comma separated." htmlFor="edit-certifications">
          <TextInput
            id="edit-certifications"
            value={certifications}
            onChange={setCertifications}
            placeholder="CPC, Google Ads Search"
          />
        </Field>
        <Field label="English" htmlFor="edit-english">
          <Select
            id="edit-english"
            value={englishLevel}
            onChange={setEnglishLevel}
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "native", label: "Native" },
              { value: "fluent", label: "Fluent" },
              { value: "conversational", label: "Conversational" },
              { value: "basic", label: "Basic" },
            ]}
          />
        </Field>
        <Field label="Timezone overlap you can hold" htmlFor="edit-overlap">
          <Select
            id="edit-overlap"
            value={preferredOverlap}
            onChange={setPreferredOverlap}
            options={[
              { value: "", label: "No preference" },
              { value: "PH hours only", label: "PH hours only" },
              { value: "Up to 4h US overlap", label: "Up to 4h US overlap" },
              { value: "Full US shift", label: "Full US shift" },
              { value: "Flexible", label: "Flexible" },
            ]}
          />
        </Field>

        <Field label="Portfolio or website" htmlFor="edit-portfolio">
          <TextInput
            id="edit-portfolio"
            type="url"
            inputMode="url"
            value={portfolioUrl}
            onChange={setPortfolioUrl}
            placeholder="https://"
          />
        </Field>
        <Field label="LinkedIn" htmlFor="edit-linkedin">
          <TextInput
            id="edit-linkedin"
            type="url"
            inputMode="url"
            value={linkedinUrl}
            onChange={setLinkedinUrl}
            placeholder="https://linkedin.com/in/"
          />
        </Field>
        <Field label="GitHub" htmlFor="edit-github">
          <TextInput
            id="edit-github"
            type="url"
            inputMode="url"
            value={githubUrl}
            onChange={setGithubUrl}
            placeholder="https://github.com/"
          />
        </Field>

        {error && <p className="text-sm text-ember">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "saved" && <Check className="h-4 w-4" />}
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-[44px] items-center px-1 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Done
          </button>
        </div>
      </form>
    </section>
  );
}
