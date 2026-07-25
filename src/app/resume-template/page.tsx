import type { Metadata } from "next";
import { ArrowRight, Check, Download, X } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Resume template for Filipino remote workers",
  description:
    "A free plain-text resume template built for how shortlisted.ph reads resumes. Headline, skills, rate and dated roles, in the format that parses cleanly. Download it, fill it in, upload it.",
  path: "/resume-template",
});

const TEMPLATE_FILE = "/shortlisted-resume-template.txt";

/**
 * Every section here maps to a field the parser extracts or a dimension the
 * matcher scores. Nothing is included because a generic CV has it.
 */
const SECTIONS: [string, string][] = [
  [
    "Headline",
    "One line: role plus specialty. It becomes the first thing an employer reads on your profile, and its words are searched when a job description is matched against you. “Dental billing specialist for US practices” carries three matchable terms; “Hardworking professional” carries none.",
  ],
  [
    "Summary",
    "Two or three sentences of fact. What you do, who for, on what software. Claims you cannot support are dropped rather than kept, so vague writing costs you lines on your profile.",
  ],
  [
    "City",
    "City and province, not a street address. Employers filter on it and we never need more than that.",
  ],
  [
    "Years of experience",
    "Write the number. Experience is a fifth of your match score and the scale tops out at five years, so a plain “6” is worth more than a decade of dates an employer has to add up.",
  ],
  [
    "Rate in USD per hour",
    "State one. Rate is another fifth of the score, and a resume with no number in it scores below anyone whose rate lands inside the employer’s stated band. You can change it on your profile later.",
  ],
  [
    "Skills",
    "The largest single input, at nearly half your match score. Software, systems and concrete capabilities — Dentrix, Xero, insurance verification, CDT coding. Up to 20 are kept. Soft-skill filler is discarded on sight.",
  ],
  [
    "Roles with dates",
    "Job title, employer, start year and end year, up to 12 of them. Titles are matched against job descriptions the same way skills are, so a real title earns credit that “various clients” does not.",
  ],
];

const GOOD: string[] = [
  "One column, top to bottom. Text is read in the order it sits in the file.",
  "Skills one per line, or comma separated. A skill named in a paragraph is easy to miss.",
  "The bare tool name: “Xero”. Words like experience, strong, proven and years are treated as noise and stripped.",
  "Two skills, two entries. A slash joins them into one term that matches nothing: Photoshop / Illustrator becomes a word no employer will ever type.",
  "Start and end years on every role: 2022 - 2026. “Present” ages badly and reads as undated a year from now.",
  "PDF, DOCX or TXT, under 5MB. The filled-in template can be uploaded as-is.",
];

const BAD: string[] = [
  "Tables and two-column layouts. Extraction reads them line by line, so your dates end up interleaved with your job titles.",
  "Text inside images, or a resume scanned from paper. No text comes out, and the upload is rejected.",
  "Icons and symbols standing in for words — a phone glyph is not a phone number to a parser.",
  "Headers and footers carrying real content. They are extracted out of order or not at all.",
  "Twelve pages. Only the first stretch of text is read, so anything essential belongs near the top.",
  "Listing 40 skills. The first 20 are kept, and padding them with soft skills wastes the slots that count.",
];

const BLANK_TEMPLATE = `[Your Full Name]
[City, Province]
[email] | [mobile]

HEADLINE
[One line: your role plus your specialty. No adjectives.]

SUMMARY
[Two or three sentences. What you do, for whom, with what tools.]

YEARS OF EXPERIENCE
[A number, e.g. 6]

RATE
[USD per hour, e.g. USD 12 per hour]

SKILLS
[Skill]
[Skill]
[Skill]

EXPERIENCE

[Job Title] — [Employer] ([Start year] - [End year])
[What you were responsible for, in one line.]
[An outcome with a number in it, if you have one.]

[Job Title] — [Employer] ([Start year] - [End year])
[What you were responsible for, in one line.]
[An outcome with a number in it, if you have one.]

EDUCATION
[Degree or course] — [School] ([Year])

CERTIFICATIONS
[Certification] — [Issuer] ([Year])`;

/** The download target is a static file, not a route — a plain anchor styled
 *  in the primary CTA voice, since ButtonLink renders a next/link. */
function DownloadButton() {
  return (
    <a
      href={TEMPLATE_FILE}
      download
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <Download className="h-4 w-4" strokeWidth={1.75} /> Download the template
    </a>
  );
}

export default function ResumeTemplatePage() {
  return (
    <PublicPage>
      {/* Hero — Long-Document opening at reading measure. */}
      <section className="mx-auto w-full max-w-3xl px-5 pt-14 pb-12 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">Resume template</p>
        <h1 className="font-display mt-4 font-semibold leading-[1.1] tracking-tight text-ink [font-size:var(--text-h1)]">
          A resume format we can actually read
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Your resume is not read by a recruiter here. It is read once, converted into the standing
          profile that every hidden job description gets matched against, and then it is done. A
          resume we parse cleanly produces a profile with your skills, your rate and your dated
          roles on it, and that profile appears on more shortlists than a thin one.
        </p>
        <p className="mt-4 leading-relaxed text-ink-soft">
          This template exists to make those fields impossible to miss. It is plain text, so it
          opens in Notepad, Google Docs, Pages or anything else, and you can upload the finished
          file exactly as it is.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <DownloadButton />
          <span className="text-sm text-ink-soft">Plain text, 4KB, free.</span>
        </div>
      </section>

      {/* What each section is for. */}
      <Section tone="white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            What each section is for
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Seven sections, each one feeding something the matcher uses. There is no section here
            for its own sake.
          </p>
          <dl className="mt-8 space-y-5">
            {SECTIONS.map(([term, detail]) => (
              <Card key={term} className="p-6">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{detail}</dd>
              </Card>
            ))}
          </dl>
          <p className="mt-6 text-sm leading-relaxed text-ink-faint">
            Two things the resume cannot do for you: your weekly availability is set on your profile
            rather than read from the file, and a skill counts double once someone you worked with
            through this platform confirms the outcome.
          </p>
        </div>
      </Section>

      {/* The blank structure. */}
      <Section tone="paper">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            The structure
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            The blank version. The downloadable file adds a filled-in example underneath it, which is
            the part most people actually copy.
          </p>
          <Card className="mt-6 overflow-x-auto">
            <pre className="min-w-max p-5 font-mono text-xs leading-relaxed text-ink-soft sm:text-sm">
              {BLANK_TEMPLATE}
            </pre>
          </Card>
        </div>
      </Section>

      {/* Parses / doesn't parse. */}
      <Section tone="white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            What parses, and what does not
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Card className="p-6">
              <span className="inline-flex items-center gap-1.5 [border-radius:var(--radius-pill)] bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> Reads cleanly
              </span>
              <ul className="mt-4 space-y-3">
                {GOOD.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-ink-soft">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <span className="inline-flex items-center gap-1.5 [border-radius:var(--radius-pill)] bg-ember-soft px-3 py-1 text-xs font-medium text-ember">
                <X className="h-3.5 w-3.5" strokeWidth={1.75} /> Loses information
              </span>
              <ul className="mt-4 space-y-3">
                {BAD.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-ink-soft">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink-faint">
            None of this asks you to write for a machine at the cost of writing for a person. The
            profile we build is shown to employers as your own claim, so accuracy is the whole
            point. A resume that is easy to parse is usually just a resume that is easy to read.
          </p>
        </div>
      </Section>

      {/* Close. */}
      <Section tone="paper">
        <div className="mx-auto max-w-3xl">
          <Card className="p-7">
            <h2 className="font-display text-xl font-semibold text-ink">When it is filled in</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Upload it once. You can correct anything we got wrong before the profile goes live, and
              you never have to send it anywhere again.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <ButtonLink href="/onboarding" variant="solid">
                Upload your resume <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </ButtonLink>
              <a href={TEMPLATE_FILE} download className="text-sm font-medium text-brand hover:underline">
                Download the template
              </a>
            </div>
          </Card>
        </div>
      </Section>
    </PublicPage>
  );
}
