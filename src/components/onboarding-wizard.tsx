"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Loader2, Plus, ShieldAlert } from "lucide-react";
import { api } from "@/lib/auth-client";
import type { GapKey } from "@/lib/resume";
import { ChipList, Field, Select, TextArea, TextInput } from "./onboarding-fields";

type Engagement = { role: string; company: string; span: string; confirmed?: boolean };

type ProfileFields = {
  headline: string | null;
  summary: string | null;
  city: string | null;
  rateUsd: number | null;
  availability: string;
  committedHours: number;
  preferredOverlap: string | null;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  education: string | null;
  englishLevel: string | null;
  tools: string | null;
  certifications: string | null;
};

type Props = {
  hasResume: boolean;
  gaps: GapKey[];
  profile: ProfileFields;
  skills: { name: string; confirmed: boolean }[];
  engagements: Engagement[];
};

type StepId = "identity" | "skills" | "experience" | "extras" | "rate" | "review";
type Stage = "gate" | "upload" | "parsing" | "steps";

const gateRules: [string, string][] = [
  [
    "We match verified experience, not ambition",
    "Your profile is ranked against what your resume and past engagements actually support. Claims nobody can back count for less.",
  ],
  [
    "One rate, for everyone",
    "You set a standing rate. It locks for 30 days and its history is visible to employers who shortlist you. No quoting one number to a startup and another to a US company.",
  ],
  [
    "Fabrication ends the account",
    "Invented experience, borrowed portfolios, or fake references mean removal: permanent, and bound to your identity.",
  ],
  [
    "You never pay anyone. Ever.",
    "No listing, matching, or placement fees. If anyone asks you for money to be shortlisted or hired, report it.",
  ],
];

/**
 * The wizard shows only the steps this person still has gaps in, so a rich
 * resume produces three screens and a thin one produces six. Skills and rate
 * are the exceptions: skills carries the most weight in matching, and an empty
 * rate keeps someone out of shortlists they would otherwise top.
 */
function buildSteps(gaps: GapKey[]): StepId[] {
  const has = (k: GapKey) => gaps.includes(k);
  const steps: StepId[] = [];
  if (has("headline") || has("summary") || has("city")) steps.push("identity");
  steps.push("skills");
  if (has("engagements")) steps.push("experience");
  if (has("links") || has("tools") || has("education") || has("english") || has("certifications")) {
    steps.push("extras");
  }
  steps.push("rate");
  steps.push("review");
  return steps;
}

const STEP_TITLE: Record<StepId, string> = {
  identity: "Confirm who you are",
  skills: "Your skills",
  experience: "Where you have worked",
  extras: "A few things your resume left out",
  rate: "Rate and availability",
  review: "Review and publish",
};

export function OnboardingWizard({ hasResume, gaps, profile, skills, engagements }: Props) {
  const router = useRouter();

  // Built once. Recomputing as fields fill would shrink the list under the
  // user's feet and renumber the step they are standing on.
  const [steps] = useState(() => buildSteps(gaps));
  const [stage, setStage] = useState<Stage>(hasResume ? "steps" : "gate");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [skillList, setSkillList] = useState<string[]>(() => skills.map((s) => s.name));
  const [skillDraft, setSkillDraft] = useState("");
  const [jobs, setJobs] = useState<Engagement[]>(engagements);
  const [jobDraft, setJobDraft] = useState<Engagement>({ role: "", company: "", span: "" });
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl ?? "");
  const [education, setEducation] = useState(profile.education ?? "");
  const [englishLevel, setEnglishLevel] = useState(profile.englishLevel ?? "");
  const [tools, setTools] = useState(profile.tools ?? "");
  const [certifications, setCertifications] = useState(profile.certifications ?? "");
  const [rate, setRate] = useState(profile.rateUsd ? String(profile.rateUsd) : "");
  const [availability, setAvailability] = useState(profile.availability);
  const [committedHours, setCommittedHours] = useState(String(profile.committedHours));
  const [preferredOverlap, setPreferredOverlap] = useState(profile.preferredOverlap ?? "");

  const step = steps[index];
  // A confirmed skill is backed by a mutual outcome confirmation, so it is not
  // the talent's alone to delete — the API refuses it too.
  const confirmedSkills = new Set(skills.filter((s) => s.confirmed).map((s) => s.name));

  async function handleFile(file: File) {
    setError(null);
    setStage("parsing");
    try {
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/api/talent/resume/upload-url",
        {
          method: "POST",
          body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
        },
      );

      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again");

      await api("/api/talent/resume/parse", { method: "POST", body: JSON.stringify({ key }) });

      // ponytail: full reload so the server recomputes the gaps the parse just
      // closed and the wizard mounts on the real remaining steps. Swap for a
      // client-side gap recompute only if the extra round trip ever shows.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("upload");
    }
  }

  /** Every step writes before it advances — a drop-out resumes where they left. */
  async function save(body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      await api("/api/talent/profile", { method: "PATCH", body: JSON.stringify(body) });
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    setError(null);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function saveStep() {
    if (step === "identity") {
      return save({ headline: headline.trim(), summary: summary.trim(), city: city.trim() });
    }
    if (step === "skills") return save({ skills: skillList });
    if (step === "experience") {
      return save({ engagements: jobs.map(({ role, company, span }) => ({ role, company, span })) });
    }
    if (step === "extras") {
      return save({
        portfolioUrl: portfolioUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        githubUrl: githubUrl.trim(),
        education: education.trim(),
        englishLevel: englishLevel || null,
        tools: tools.trim(),
        certifications: certifications.trim(),
      });
    }
    if (step === "rate") return saveRate();
  }

  async function saveRate() {
    setError(null);
    const parsedRate = Number(rate);
    if (!parsedRate || parsedRate < 1) {
      setError("Set your standing rate. Employers filter on it, and a blank rate keeps you out of slates.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/talent/rate", {
        method: "PUT",
        body: JSON.stringify({ rateUsd: parsedRate }),
      });
      await api("/api/talent/profile", {
        method: "PATCH",
        body: JSON.stringify({
          availability,
          committedHours: Number(committedHours) || 0,
          preferredOverlap: preferredOverlap.trim(),
        }),
      });
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your rate");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/talent/publish", { method: "POST" });
      router.push("/talent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
      setBusy(false);
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (skillList.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillDraft("");
      return;
    }
    setSkillList([...skillList, value].slice(0, 20));
    setSkillDraft("");
  }

  function addJob() {
    if (!jobDraft.role.trim() || !jobDraft.company.trim()) return;
    setJobs([...jobs, { ...jobDraft }].slice(0, 12));
    setJobDraft({ role: "", company: "", span: "" });
  }

  if (stage === "gate") {
    return (
      <>
        <p className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-ember-soft px-3 py-1 text-xs font-medium text-ember">
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} /> Read this first
        </p>
        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          This platform has a bar.
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Being shortlisted here means something because of what we don&rsquo;t allow. Two minutes of
          straight talk before you upload:
        </p>
        <ul className="mt-7 space-y-4">
          {gateRules.map(([title, body]) => (
            <li key={title} className="rounded-2xl border border-line bg-white p-5">
              <p className="font-medium text-ink">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setStage("upload")}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark sm:w-auto sm:py-3"
          >
            I understand: build my profile <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <Link
            href="/conduct"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand hover:underline"
          >
            Read the full Code of Conduct
          </Link>
        </div>
      </>
    );
  }

  if (stage === "upload") {
    return (
      <>
        {error && <ErrorNote message={error} />}
        <h1 className="font-display mt-8 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Upload your resume. That&rsquo;s the whole job.
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          We build your profile from it and only ask about what it leaves out. The better your
          resume, the fewer questions you get.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-8 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-white px-4 py-12 text-center transition-colors hover:border-brand hover:bg-brand-soft/40 sm:px-6 sm:py-14"
        >
          <FileUp className="h-8 w-8 text-brand" strokeWidth={1.75} />
          <span className="font-medium text-ink">Choose your resume</span>
          <span className="text-sm text-balance text-ink-faint">
            PDF, DOC, DOCX or TXT · up to 5MB
          </span>
        </button>
        <p className="mt-6 text-sm leading-relaxed text-ink-faint">
          Free forever for talent. Verification is optional, and your ID or NBI clearance never
          touches our servers. You show them directly to an employer once you&rsquo;re hired.
        </p>
      </>
    );
  }

  if (stage === "parsing") {
    return (
      <div className="pt-20 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
          <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={1.75} />
        </span>
        <h1 className="font-display mt-6 text-2xl font-semibold text-ink">Reading your resume</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Extracting your experience and skills. This takes a few seconds.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8">
        <div className="flex items-center justify-between text-xs text-ink-faint">
          <span>
            Step {index + 1} of {steps.length}
          </span>
          {step !== "rate" && step !== "review" && (
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center px-1 text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-60"
            >
              Skip
            </button>
          )}
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="font-display mt-6 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {STEP_TITLE[step]}
      </h1>

      {error && <ErrorNote message={error} />}

      <div className="mt-6 space-y-4">
        {step === "identity" && (
          <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
            <Field label="Headline" hint="Role and specialty, one line." htmlFor="headline">
              <TextInput
                id="headline"
                value={headline}
                onChange={setHeadline}
                placeholder="Dental insurance verification specialist"
              />
            </Field>
            <Field label="Summary" hint="Two or three factual sentences." htmlFor="summary">
              <TextArea
                id="summary"
                value={summary}
                onChange={setSummary}
                placeholder="What you do, for whom, and with what tools."
              />
            </Field>
            <Field label="City" htmlFor="city">
              <TextInput id="city" value={city} onChange={setCity} placeholder="Cebu City" />
            </Field>
          </div>
        )}

        {step === "skills" && (
          <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              Skills carry more weight than anything else here. Remove what you would not want to be
              matched on, add what the resume missed.
            </p>
            <ChipList
              items={skillList}
              onRemove={(s) => setSkillList(skillList.filter((x) => x !== s))}
              locked={(s) => confirmedSkills.has(s)}
            />
            <div className="flex gap-2">
              <TextInput
                id="skill-draft"
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
        )}

        {step === "experience" && (
          <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
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
            <div className="space-y-3">
              <Field label="Role" htmlFor="job-role">
                <TextInput
                  id="job-role"
                  value={jobDraft.role}
                  onChange={(v) => setJobDraft({ ...jobDraft, role: v })}
                  placeholder="Medical billing specialist"
                  onEnter={addJob}
                />
              </Field>
              <Field label="Company" htmlFor="job-company">
                <TextInput
                  id="job-company"
                  value={jobDraft.company}
                  onChange={(v) => setJobDraft({ ...jobDraft, company: v })}
                  placeholder="Bright Smiles Dental"
                  onEnter={addJob}
                />
              </Field>
              <Field label="Span" htmlFor="job-span">
                <TextInput
                  id="job-span"
                  value={jobDraft.span}
                  onChange={(v) => setJobDraft({ ...jobDraft, span: v })}
                  placeholder="2022 - 2025"
                  onEnter={addJob}
                />
              </Field>
              <button
                type="button"
                onClick={addJob}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} /> Add this role
              </button>
            </div>
          </div>
        )}

        {step === "extras" && (
          <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
            <p className="text-sm leading-relaxed text-ink-soft">
              All optional. Each one gives an employer something to check.
            </p>
            {gaps.includes("links") && (
              <>
                <Field label="Portfolio or website" htmlFor="portfolio">
                  <TextInput
                    id="portfolio"
                    type="url"
                    inputMode="url"
                    value={portfolioUrl}
                    onChange={setPortfolioUrl}
                    placeholder="https://"
                  />
                </Field>
                <Field label="LinkedIn" htmlFor="linkedin">
                  <TextInput
                    id="linkedin"
                    type="url"
                    inputMode="url"
                    value={linkedinUrl}
                    onChange={setLinkedinUrl}
                    placeholder="https://linkedin.com/in/"
                  />
                </Field>
                <Field label="GitHub" htmlFor="github">
                  <TextInput
                    id="github"
                    type="url"
                    inputMode="url"
                    value={githubUrl}
                    onChange={setGithubUrl}
                    placeholder="https://github.com/"
                  />
                </Field>
              </>
            )}
            {gaps.includes("tools") && (
              <Field
                label="Tools and software"
                hint="Comma separated. Named tools match better than categories."
                htmlFor="tools"
              >
                <TextInput
                  id="tools"
                  value={tools}
                  onChange={setTools}
                  placeholder="Dentrix, QuickBooks Online, Slack"
                />
              </Field>
            )}
            {gaps.includes("certifications") && (
              <Field label="Certifications" hint="Comma separated." htmlFor="certifications">
                <TextInput
                  id="certifications"
                  value={certifications}
                  onChange={setCertifications}
                  placeholder="CPC, Google Ads Search"
                />
              </Field>
            )}
            {gaps.includes("education") && (
              <Field label="Education" htmlFor="education">
                <TextInput
                  id="education"
                  value={education}
                  onChange={setEducation}
                  placeholder="BS Accountancy, University of San Carlos"
                />
              </Field>
            )}
            {gaps.includes("english") && (
              <Field label="English" htmlFor="english">
                <Select
                  id="english"
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
            )}
          </div>
        )}

        {step === "rate" && (
          <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
            <Field
              label="Standing rate (USD / hour)"
              hint="Locks for 30 days the moment you save it, published or not. Its history is visible to employers who shortlist you."
              htmlFor="rate"
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-semibold text-ink">$</span>
                <TextInput
                  id="rate"
                  type="number"
                  inputMode="decimal"
                  value={rate}
                  onChange={setRate}
                  placeholder="12"
                />
                <span className="shrink-0 text-sm text-ink-faint">/ hr</span>
              </div>
            </Field>
            <Field label="Availability" htmlFor="availability">
              <Select
                id="availability"
                value={availability}
                onChange={setAvailability}
                options={[
                  { value: "open", label: "Open to work" },
                  { value: "partial", label: "Partly booked" },
                  { value: "booked", label: "Fully booked" },
                ]}
              />
            </Field>
            <Field
              label="Hours already committed each week"
              hint="What existing clients take. The rest is what we can offer."
              htmlFor="committed"
            >
              <TextInput
                id="committed"
                type="number"
                inputMode="numeric"
                value={committedHours}
                onChange={setCommittedHours}
                placeholder="0"
              />
            </Field>
            <Field label="Timezone overlap you can hold" htmlFor="overlap">
              <Select
                id="overlap"
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
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <ReviewRow label="Headline" value={headline} />
            <ReviewRow label="Summary" value={summary} />
            <ReviewRow label="City" value={city} />
            <ReviewRow label="Skills" value={skillList.join(", ")} />
            <ReviewRow
              label="Experience"
              value={jobs.map((j) => `${j.role} · ${j.company}`).join("\n")}
            />
            <ReviewRow label="Rate" value={rate ? `$${rate} / hr` : ""} />
            <ReviewRow
              label="Availability"
              value={`${availability}${committedHours ? ` · ${committedHours}h committed` : ""}${
                preferredOverlap ? ` · ${preferredOverlap}` : ""
              }`}
            />
            <ReviewRow label="Tools" value={tools} />
            <ReviewRow label="Certifications" value={certifications} />
            <ReviewRow label="Education" value={education} />
            <ReviewRow label="English" value={englishLevel} />
            <ReviewRow
              label="Links"
              value={[portfolioUrl, linkedinUrl, githubUrl].filter(Boolean).join("\n")}
            />
          </div>
        )}
      </div>

      <div className="mt-8">
        {step === "review" ? (
          <>
            <button
              type="button"
              onClick={publish}
              disabled={busy}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark disabled:opacity-60 sm:w-auto sm:py-3"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
              {busy ? "Publishing…" : "Publish my profile"}
              {!busy && <ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            </button>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Publishing is your decision. Matching starts immediately and you can refine everything
              later.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={saveStep}
            disabled={busy}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark disabled:opacity-60 sm:w-auto sm:py-3"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
            {busy ? "Saving…" : "Save and continue"}
            {!busy && <ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        )}
        {index > 0 && !busy && (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center text-sm font-medium text-ink-soft hover:text-ink sm:ml-4 sm:mt-0 sm:w-auto"
          >
            Back
          </button>
        )}
      </div>
    </>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{message}</p>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 leading-relaxed break-words whitespace-pre-line text-ink">
        {value.trim() ? value : <span className="text-ink-faint">Not set</span>}
      </p>
    </div>
  );
}
