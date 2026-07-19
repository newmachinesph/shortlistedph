export type Brief = {
  id: string;
  title: string;
  company: string;
  companyBlurb: string;
  budgetMin: number;
  budgetMax: number;
  hoursPerWeek: number;
  overlap: string;
  mustHaves: string[];
  niceToHaves: string[];
  status: "slate_ready" | "matching" | "draft";
  unlocked: boolean;
  postedAgo: string;
  candidatesScanned: number;
};

export type SlateEntry = {
  candidateId: string;
  score: number;
  dims: { skills: number; rate: number; overlap: number; experience: number };
  reasons: string[];
};

export const briefs: Brief[] = [
  {
    id: "medical-va-dental",
    title: "Medical VA for a growing dental group",
    company: "Harbor Dental Group",
    companyBlurb: "3-location dental group in Austin, TX",
    budgetMin: 8,
    budgetMax: 11,
    hoursPerWeek: 40,
    overlap: "≥ 4h EST",
    mustHaves: ["US dental practice experience", "Insurance verification", "Practice management software", "Phone-heavy comfort"],
    niceToHaves: ["Dentrix specifically", "AR follow-up"],
    status: "slate_ready",
    unlocked: true,
    postedAgo: "2 days ago",
    candidatesScanned: 512,
  },
  {
    id: "senior-react-saas",
    title: "Senior React engineer, product team",
    company: "Ledgerline",
    companyBlurb: "Seed-stage fintech SaaS, remote-first (US)",
    budgetMin: 18,
    budgetMax: 28,
    hoursPerWeek: 40,
    overlap: "≥ 3h PST",
    mustHaves: ["5+ yrs React", "TypeScript", "Owns features end-to-end", "Postgres comfort"],
    niceToHaves: ["Next.js App Router", "Fintech background"],
    status: "slate_ready",
    unlocked: false,
    postedAgo: "5 days ago",
    candidatesScanned: 512,
  },
  {
    id: "cx-lead-skincare",
    title: "CX lead for AU skincare brand",
    company: "Glowfolk",
    companyBlurb: "DTC skincare, Melbourne — 8-person team",
    budgetMin: 7,
    budgetMax: 10,
    hoursPerWeek: 30,
    overlap: "AEST business hours",
    mustHaves: ["Gorgias or Zendesk", "Shopify", "Led a small team"],
    niceToHaves: ["Beauty/skincare vertical"],
    status: "matching",
    unlocked: false,
    postedAgo: "6 hours ago",
    candidatesScanned: 347,
  },
  {
    id: "bookkeeper-parttime",
    title: "Part-time bookkeeper, QuickBooks",
    company: "Harbor Dental Group",
    companyBlurb: "3-location dental group in Austin, TX",
    budgetMin: 8,
    budgetMax: 12,
    hoursPerWeek: 20,
    overlap: "flexible",
    mustHaves: ["QuickBooks Online", "US small-business books"],
    niceToHaves: ["Dental industry", "Gusto payroll"],
    status: "draft",
    unlocked: false,
    postedAgo: "draft saved 1 day ago",
    candidatesScanned: 0,
  },
];

export const slates: Record<string, SlateEntry[]> = {
  "medical-va-dental": [
    {
      candidateId: "kristine-bautista",
      score: 94,
      dims: { skills: 96, rate: 100, overlap: 95, experience: 88 },
      reasons: [
        "6 yrs inside US dental practices — Dentrix and Eaglesoft daily, both confirmed",
        "Standing rate $9/hr sits mid-band, unchanged for 7 months",
        "Worked full EST shifts for 3 years at her last confirmed engagement",
      ],
    },
    {
      candidateId: "patricia-uy",
      score: 88,
      dims: { skills: 84, rate: 100, overlap: 90, experience: 78 },
      reasons: [
        "Healthcare intake + prior-auth background transfers directly to dental front office",
        "$7.50/hr is below your band floor — room to offer above her ask",
        "ID-verified, profile stable 51 days before your brief",
      ],
    },
    {
      candidateId: "louie-mendoza",
      score: 85,
      dims: { skills: 82, rate: 100, overlap: 98, experience: 80 },
      reasons: [
        "5 yrs medical billing and AR calling — the phone-heavy half of your must-haves",
        "4 straight years on EST hours, confirmed engagement",
        "Not ID-verified yet — verification is optional and offered at hire",
      ],
    },
    {
      candidateId: "rhea-navarro",
      score: 78,
      dims: { skills: 68, rate: 95, overlap: 75, experience: 92 },
      reasons: [
        "9 yrs EA experience incl. 3 supporting a clinic owner — strong ops maturity",
        "Partial availability (20h committed) — fits if you can split the role",
        "No dental software history — would need tooling ramp-up",
      ],
    },
    {
      candidateId: "camille-ocampo",
      score: 71,
      dims: { skills: 58, rate: 96, overlap: 70, experience: 74 },
      reasons: [
        "Patient-facing communication skills proven in CX lead role, CSAT 88→96",
        "No healthcare vertical experience — adjacent fit only",
        "Rate $8.50 inside band; profile stable 42 days",
      ],
    },
  ],
  "senior-react-saas": [
    {
      candidateId: "paolo-reyes",
      score: 91,
      dims: { skills: 95, rate: 100, overlap: 82, experience: 94 },
      reasons: [
        "8 yrs full-stack, led a Next.js + Postgres migration at a US fintech — vertical match",
        "$22/hr sits mid-band, unchanged 6 months",
        "Both engagements outcome-confirmed by past employers",
      ],
    },
    {
      candidateId: "nico-fernandez",
      score: 84,
      dims: { skills: 88, rate: 100, overlap: 80, experience: 72 },
      reasons: [
        "Strong React/Next.js App Router work, confirmed at a US agency",
        "$16/hr is under your band floor — senior output at mid-level cost",
        "5 yrs experience vs your 5+ requirement — at the line, not past it",
      ],
    },
    {
      candidateId: "kevin-salazar",
      score: 68,
      dims: { skills: 52, rate: 100, overlap: 78, experience: 65 },
      reasons: [
        "Adjacent profile: strong SQL/data skills, frontend still developing",
        "Included because your brief weighted Postgres comfort highly",
        "Honest flag: does not meet the 5-yr React must-have",
      ],
    },
  ],
};

