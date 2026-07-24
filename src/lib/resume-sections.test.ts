/**
 * Standard-resume-format parsing.
 * Run with: node --experimental-strip-types src/lib/resume-sections.test.ts
 *
 * The template tells candidates the headings are "the anchors our parser looks
 * for". These tests are what makes that sentence true, and the fallback cases
 * are what keeps it from breaking the 779 migrated resumes that predate it.
 */
import assert from "node:assert/strict";
import {
  labelledBlocks,
  readTemplateFacts,
  splitSections,
} from "./resume-sections.ts";

let pass = 0;
const check = (label: string, fn: () => void) => {
  fn();
  pass++;
  console.log(`  ok  ${label}`);
};

/** The filled skeleton from docs/engine/shortlisted-resume-template.md. */
const TEMPLATE = `CONTACT
Maria Santos
Cebu City, Cebu, Philippines
maria@example.com · +63 917 000 0000

AVAILABILITY & RATE
Rate: USD 8 / hour
Hours available: 40 hours per week
Shift windows I can work: 9PM-6AM PHT (US Eastern business hours)
Earliest start: 2 weeks
Engagement type: full-time

HEADLINE
Ecommerce operations VA - Shopify, Gorgias, ShipStation - 5 yrs - US retail clients

SUMMARY
I run customer support and order operations for US ecommerce brands doing
2,000-5,000 orders a month. I own the helpdesk queue, returns and refunds.

WORK EXPERIENCE

Customer Support Specialist | Acme Apparel | US | Ecommerce
Mar 2022 - Present | Full-time | Remote
Tools: Gorgias, Shopify, ShipStation
- Handled 40-60 daily customer tickets in Gorgias.

TOOLS & PLATFORMS
Helpdesk: Gorgias - 4 yrs - 2026; Zendesk - 2 yrs - 2023
Ecommerce: Shopify - 5 yrs - 2026

FUNCTIONS I CAN OWN
- Inbox and helpdesk management

WORK SETUP
Primary internet: Fiber, 200 Mbps

LANGUAGE & COMMUNICATION
English: written - advanced; spoken - intermediate

EDUCATION & CERTIFICATIONS
BS Psychology, University of San Carlos, 2019
`;

// ── splitting ────────────────────────────────────────────────────────────

check("splits the template into its sections", () => {
  const s = splitSections(TEMPLATE);
  assert.ok(s, "template must parse");
  assert.ok(s.CONTACT?.includes("Maria Santos"));
  assert.ok(s["WORK EXPERIENCE"]?.includes("Acme Apparel"));
  assert.ok(s["TOOLS & PLATFORMS"]?.includes("Gorgias"));
  assert.ok(!s.HEADLINE?.includes("SUMMARY"), "sections must not bleed into each other");
});

check("accepts 'and' where the template writes '&'", () => {
  const s = splitSections(TEMPLATE.replace("TOOLS & PLATFORMS", "Tools and Platforms"));
  assert.ok(s?.["TOOLS & PLATFORMS"]?.includes("Gorgias"));
});

check("returns null for a free-form resume", () => {
  assert.equal(
    splitSections(`Maria Santos
Customer support professional with five years of experience.

Experience
Acme Apparel, 2022 to present. Handled customer tickets.`),
    null,
  );
});

check("returns null on a coincidental heading or two", () => {
  // "SUMMARY" and "CONTACT" alone are common in ordinary resumes; acting on
  // them would apply strict field parsing to a document that never opted in.
  assert.equal(splitSections("SUMMARY\nA support pro.\n\nCONTACT\nmaria@example.com"), null);
});

check("does not mistake a long body line for a heading", () => {
  const s = splitSections(
    TEMPLATE.replace("- Handled 40-60 daily customer tickets in Gorgias.", "WORK EXPERIENCE ACROSS THREE LONG TERM CLIENTS IN US RETAIL"),
  );
  assert.ok(s?.["WORK EXPERIENCE"]?.includes("Acme Apparel"), "content survived");
});

// ── deterministic field reads ────────────────────────────────────────────

check("reads rate, hours, shift window and start date off the page", () => {
  const f = readTemplateFacts(splitSections(TEMPLATE)!);
  assert.equal(f.rateUsd, 8);
  assert.equal(f.hoursPerWeek, 40);
  assert.equal(f.earliestStartDays, 14, "'2 weeks' is 14 days");
  assert.ok(f.shiftWindows?.startsWith("9PM-6AM PHT"));
  assert.equal(f.city, "Cebu City");
  assert.ok(f.headline?.startsWith("Ecommerce operations VA"));
  assert.ok(f.summary?.includes("2,000-5,000 orders a month"));
  assert.ok(f.tools?.includes("Gorgias - 4 yrs - 2026"));
});

check("converts every start-date phrasing the template suggests", () => {
  const withStart = (v: string) =>
    readTemplateFacts(splitSections(TEMPLATE.replace("Earliest start: 2 weeks", `Earliest start: ${v}`))!)
      .earliestStartDays;
  assert.equal(withStart("immediate"), 0);
  assert.equal(withStart("30 days"), 30);
  assert.equal(withStart("1 month"), 30);
  assert.equal(withStart("whenever"), null, "unreadable stays null, never a guess");
});

check("treats an unfilled skeleton placeholder as no answer", () => {
  const f = readTemplateFacts(splitSections(TEMPLATE.replace("Rate: USD 8 / hour", "Rate: [ ]"))!);
  assert.equal(f.rateUsd, null);
});

check("survives a section the candidate left out entirely", () => {
  const f = readTemplateFacts(splitSections(TEMPLATE.replace(/TOOLS & PLATFORMS[\s\S]*?\n\n/, ""))!);
  assert.equal(f.tools, null);
  assert.equal(f.rateUsd, 8, "unrelated fields still read");
});

// ── what goes to the model ───────────────────────────────────────────────

check("labels each block for the extractor without losing content", () => {
  const blocks = labelledBlocks(splitSections(TEMPLATE)!);
  assert.ok(blocks.includes("## WORK EXPERIENCE"));
  assert.ok(blocks.includes("Acme Apparel"));
  assert.ok(blocks.indexOf("## CONTACT") < blocks.indexOf("## WORK EXPERIENCE"), "template order kept");
});

console.log(`\n${pass} passed`);
