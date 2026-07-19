export type Skill = { name: string; confirmed: boolean };

export type Engagement = {
  role: string;
  company: string;
  span: string;
  outcome: "confirmed" | "reported";
};

export type Candidate = {
  id: string;
  name: string;
  headline: string;
  city: string;
  years: number;
  rateUsd: number;
  rateStableMonths: number;
  profileStableDays: number;
  idVerified: boolean;
  availability: "open" | "partial" | "booked";
  committedHours: number;
  summary: string;
  skills: Skill[];
  history: Engagement[];
};

export const candidates: Candidate[] = [
  {
    id: "kristine-bautista",
    name: "Kristine Bautista",
    headline: "Medical VA — US dental practices",
    city: "Davao City",
    years: 6,
    rateUsd: 9,
    rateStableMonths: 7,
    profileStableDays: 74,
    idVerified: true,
    availability: "open",
    committedHours: 0,
    summary:
      "Six years inside US dental practices handling patient scheduling, insurance verification, and AR follow-up. Comfortable owning the front desk remotely — phones, recalls, treatment-plan follow-ups.",
    skills: [
      { name: "Dentrix", confirmed: true },
      { name: "Eaglesoft", confirmed: true },
      { name: "Insurance verification", confirmed: true },
      { name: "Patient scheduling", confirmed: true },
      { name: "AR follow-up", confirmed: false },
      { name: "HIPAA awareness", confirmed: false },
    ],
    history: [
      { role: "Patient Coordinator", company: "US dental group (3 locations)", span: "2022 – 2025", outcome: "confirmed" },
      { role: "Front Desk VA", company: "Solo dental practice, Florida", span: "2019 – 2022", outcome: "confirmed" },
    ],
  },
  {
    id: "patricia-uy",
    name: "Patricia Uy",
    headline: "Healthcare VA — clinics & telehealth",
    city: "Cebu City",
    years: 4,
    rateUsd: 7.5,
    rateStableMonths: 4,
    profileStableDays: 51,
    idVerified: true,
    availability: "open",
    committedHours: 10,
    summary:
      "Telehealth intake and prior-authorization specialist. Ran intake for a 12-provider behavioral health group; typed clinical notes at 80wpm with strong written English.",
    skills: [
      { name: "Patient intake", confirmed: true },
      { name: "Prior authorization", confirmed: true },
      { name: "SimplePractice", confirmed: false },
      { name: "Medical terminology", confirmed: false },
      { name: "Live chat support", confirmed: true },
    ],
    history: [
      { role: "Intake Coordinator", company: "US behavioral health group", span: "2023 – 2026", outcome: "confirmed" },
      { role: "CSR — healthcare account", company: "BPO, Cebu", span: "2021 – 2023", outcome: "reported" },
    ],
  },
  {
    id: "louie-mendoza",
    name: "Louie Mendoza",
    headline: "Medical biller & AR caller",
    city: "General Santos",
    years: 5,
    rateUsd: 8,
    rateStableMonths: 9,
    profileStableDays: 88,
    idVerified: false,
    availability: "open",
    committedHours: 0,
    summary:
      "Claims submission, denial management, and AR calling for US providers. Worked EST hours for four straight years; comfortable on outbound insurance calls all shift.",
    skills: [
      { name: "Medical billing", confirmed: true },
      { name: "Denial management", confirmed: true },
      { name: "AR calling", confirmed: true },
      { name: "Availity", confirmed: false },
      { name: "Office Ally", confirmed: false },
    ],
    history: [
      { role: "Medical Biller", company: "US billing agency", span: "2021 – 2026", outcome: "confirmed" },
    ],
  },
  {
    id: "rhea-navarro",
    name: "Rhea Navarro",
    headline: "Executive assistant — healthcare & legal",
    city: "Bacolod",
    years: 9,
    rateUsd: 9.5,
    rateStableMonths: 12,
    profileStableDays: 120,
    idVerified: true,
    availability: "partial",
    committedHours: 20,
    summary:
      "Nine years supporting US executives — two of them a clinic owner. Calendar, inbox zero, travel, light bookkeeping. Currently at 20 committed hours, open to 20 more.",
    skills: [
      { name: "Executive calendar", confirmed: true },
      { name: "Inbox management", confirmed: true },
      { name: "Light bookkeeping", confirmed: false },
      { name: "Medical office ops", confirmed: false },
    ],
    history: [
      { role: "EA to clinic owner", company: "US medspa chain", span: "2023 – present", outcome: "confirmed" },
      { role: "EA", company: "US law firm", span: "2017 – 2023", outcome: "confirmed" },
    ],
  },
  {
    id: "camille-ocampo",
    name: "Camille Ocampo",
    headline: "E-commerce CX lead",
    city: "Cebu City",
    years: 5,
    rateUsd: 8.5,
    rateStableMonths: 5,
    profileStableDays: 42,
    idVerified: true,
    availability: "open",
    committedHours: 0,
    summary:
      "Led a 6-agent support pod for a DTC skincare brand. Zendesk macros, Gorgias flows, refund policy design, CSAT from 88 to 96 in two quarters.",
    skills: [
      { name: "Zendesk", confirmed: true },
      { name: "Gorgias", confirmed: true },
      { name: "Shopify admin", confirmed: true },
      { name: "Team lead", confirmed: false },
      { name: "CSAT reporting", confirmed: false },
    ],
    history: [
      { role: "CX Lead", company: "DTC skincare brand (US)", span: "2023 – 2026", outcome: "confirmed" },
      { role: "Support agent", company: "Shopify apparel store", span: "2021 – 2023", outcome: "reported" },
    ],
  },
  {
    id: "paolo-reyes",
    name: "Paolo Reyes",
    headline: "Senior full-stack engineer — React / Node",
    city: "Quezon City",
    years: 8,
    rateUsd: 22,
    rateStableMonths: 6,
    profileStableDays: 63,
    idVerified: true,
    availability: "open",
    committedHours: 0,
    summary:
      "Eight years shipping SaaS. Led migration of a monolith to Next.js + Postgres for a US fintech; owns features end-to-end from schema to UI. Writes tests without being asked.",
    skills: [
      { name: "React / Next.js", confirmed: true },
      { name: "Node.js", confirmed: true },
      { name: "PostgreSQL", confirmed: true },
      { name: "AWS", confirmed: false },
      { name: "TypeScript", confirmed: true },
    ],
    history: [
      { role: "Senior Engineer", company: "US fintech SaaS", span: "2022 – 2026", outcome: "confirmed" },
      { role: "Full-stack dev", company: "AU logistics startup", span: "2018 – 2022", outcome: "confirmed" },
    ],
  },
  {
    id: "nico-fernandez",
    name: "Nico Fernandez",
    headline: "Frontend engineer — React / Next.js",
    city: "Davao City",
    years: 5,
    rateUsd: 16,
    rateStableMonths: 3,
    profileStableDays: 35,
    idVerified: false,
    availability: "open",
    committedHours: 0,
    summary:
      "Product-minded frontend dev. Rebuilt a marketing site + app shell in Next.js App Router; strong Tailwind, animation restraint, and Core Web Vitals discipline.",
    skills: [
      { name: "React / Next.js", confirmed: true },
      { name: "Tailwind CSS", confirmed: true },
      { name: "TypeScript", confirmed: true },
      { name: "Node.js", confirmed: false },
    ],
    history: [
      { role: "Frontend dev", company: "US martech agency", span: "2022 – 2026", outcome: "confirmed" },
    ],
  },
  {
    id: "kevin-salazar",
    name: "Kevin Salazar",
    headline: "Data analyst — SQL / Looker",
    city: "Taguig",
    years: 4,
    rateUsd: 14,
    rateStableMonths: 8,
    profileStableDays: 97,
    idVerified: true,
    availability: "partial",
    committedHours: 15,
    summary:
      "Revenue analytics for a US subscription business — dbt models, Looker dashboards, churn cohorts. Some Python, learning frontend on the side.",
    skills: [
      { name: "SQL", confirmed: true },
      { name: "Looker", confirmed: true },
      { name: "dbt", confirmed: false },
      { name: "Python", confirmed: false },
    ],
    history: [
      { role: "Data analyst", company: "US subscription SaaS", span: "2022 – present", outcome: "confirmed" },
    ],
  },
  {
    id: "jerome-delacruz",
    name: "Jerome Dela Cruz",
    headline: "Bookkeeper — QuickBooks ProAdvisor",
    city: "Iloilo City",
    years: 7,
    rateUsd: 10,
    rateStableMonths: 11,
    profileStableDays: 105,
    idVerified: true,
    availability: "open",
    committedHours: 0,
    summary:
      "Full-charge bookkeeping for US small businesses — AP/AR, reconciliations, month-end close, 1099 prep support. QuickBooks Online ProAdvisor, Xero certified.",
    skills: [
      { name: "QuickBooks Online", confirmed: true },
      { name: "Xero", confirmed: true },
      { name: "Month-end close", confirmed: true },
      { name: "Payroll (Gusto)", confirmed: false },
    ],
    history: [
      { role: "Bookkeeper", company: "US accounting firm (12 clients)", span: "2020 – 2026", outcome: "confirmed" },
    ],
  },
  {
    id: "angelica-ramos",
    name: "Angelica Ramos",
    headline: "Amazon PPC specialist",
    city: "San Fernando, Pampanga",
    years: 4,
    rateUsd: 12,
    rateStableMonths: 2,
    profileStableDays: 21,
    idVerified: false,
    availability: "open",
    committedHours: 0,
    summary:
      "Managed $80k/mo ad spend across Sponsored Products and Brands. TACoS-driven, comfortable with bulk files and negative-keyword hygiene.",
    skills: [
      { name: "Amazon PPC", confirmed: true },
      { name: "Helium 10", confirmed: false },
      { name: "Bulk operations", confirmed: false },
    ],
    history: [
      { role: "PPC Manager", company: "US Amazon aggregator", span: "2023 – 2026", outcome: "reported" },
    ],
  },
  {
    id: "mark-villanueva",
    name: "Mark Villanueva",
    headline: "Video editor — short-form & YouTube",
    city: "Baguio",
    years: 5,
    rateUsd: 11,
    rateStableMonths: 6,
    profileStableDays: 58,
    idVerified: true,
    availability: "booked",
    committedHours: 40,
    summary:
      "Edits 20+ shorts a week for two US creators plus long-form YouTube. Premiere + After Effects; strong hooks, captions, retention-aware pacing.",
    skills: [
      { name: "Premiere Pro", confirmed: true },
      { name: "After Effects", confirmed: true },
      { name: "Short-form editing", confirmed: true },
    ],
    history: [
      { role: "Lead editor", company: "US creator (2.1M subs)", span: "2023 – present", outcome: "confirmed" },
    ],
  },
  {
    id: "bianca-torres",
    name: "Bianca Torres",
    headline: "Brand & UI designer — Figma",
    city: "Makati",
    years: 5,
    rateUsd: 13,
    rateStableMonths: 4,
    profileStableDays: 47,
    idVerified: false,
    availability: "open",
    committedHours: 0,
    summary:
      "Brand systems and product UI for startups. Ships design tokens and dev-ready Figma files, not just pretty frames.",
    skills: [
      { name: "Figma", confirmed: true },
      { name: "Brand identity", confirmed: true },
      { name: "Design systems", confirmed: false },
    ],
    history: [
      { role: "Designer", company: "SG venture studio", span: "2022 – 2026", outcome: "confirmed" },
    ],
  },
  {
    id: "daniel-aquino",
    name: "Daniel Aquino",
    headline: "SEO content strategist",
    city: "Cavite",
    years: 6,
    rateUsd: 10,
    rateStableMonths: 7,
    profileStableDays: 82,
    idVerified: true,
    availability: "open",
    committedHours: 0,
    summary:
      "Topic clusters, briefs, and editing for B2B SaaS blogs. Grew one client from 4k to 60k organic sessions/mo in 18 months.",
    skills: [
      { name: "SEO strategy", confirmed: true },
      { name: "Content briefs", confirmed: true },
      { name: "Ahrefs", confirmed: false },
      { name: "Surfer", confirmed: false },
    ],
    history: [
      { role: "Content lead", company: "B2B SaaS (US)", span: "2021 – 2026", outcome: "confirmed" },
    ],
  },
  {
    id: "rowena-lim",
    name: "Rowena Lim",
    headline: "Customer support — SaaS & billing",
    city: "Dumaguete",
    years: 3,
    rateUsd: 7,
    rateStableMonths: 3,
    profileStableDays: 29,
    idVerified: false,
    availability: "open",
    committedHours: 0,
    summary:
      "Tier-1/2 SaaS support with billing specialty — Stripe disputes, dunning flows, refunds. Calm writer, fast learner.",
    skills: [
      { name: "Intercom", confirmed: true },
      { name: "Stripe billing", confirmed: false },
      { name: "Help center writing", confirmed: false },
    ],
    history: [
      { role: "Support specialist", company: "US scheduling SaaS", span: "2023 – 2026", outcome: "reported" },
    ],
  },
];

export const candidateById = (id: string) =>
  candidates.find((c) => c.id === id);

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
