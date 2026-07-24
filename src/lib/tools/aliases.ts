/**
 * Tool alias table. Pure data + one lookup — no db, no network.
 *
 * The matching spec (§1, §9) calls this mandatory and says to seed it by hand
 * from the real pool before automating: "a few hours of work that will
 * outperform any embedding-based tool matching for the next year." The Phase 0
 * baseline proved why — no candidate scored above 52 on skills on any job,
 * because scoreSkills needs an exact normalized match and the stemmer cannot
 * connect "QBO" to "QuickBooks Online". A real QuickBooks bookkeeper was
 * scoring 44 on QuickBooks.
 *
 * canonicalizeTool maps a normalized skill/requirement to a shared canonical
 * string, so the two meet on an exact compare. Anything not in the table is
 * returned unchanged, so a non-tool requirement ("bank reconciliation", "US
 * dental practice experience") behaves exactly as before — only known tool
 * aliases merge.
 *
 * ── The one rule for editing this file ──
 * A wrong merge is worse than a miss. Merging two genuinely different tools
 * (say Zendesk and Zoho) silently scores people for skills they do not have,
 * which is the exact gaming the platform exists to stop. So:
 *   - Only merge variants you are certain name the SAME product.
 *   - Never add a bare ambiguous abbreviation ("ts" could be TypeScript or
 *     Teamwork; "js" JavaScript or anything; "ppc" Google or Amazon). Those
 *     are deliberately absent — the stemmer and embedding still catch them
 *     loosely, they just do not earn a full exact-match merge.
 *   - Expand from real frequency data (scripts/tool-frequency.ts), not memory.
 *
 * The seed below is grouped by canonical for review. It covers the tool
 * families in the five baseline jobs plus the common PH-remote stack; it is a
 * starting table, not the finished one.
 */

/** canonical → the variants that mean it. The canonical is also a valid input. */
const GROUPS: Record<string, string[]> = {
  // ── Bookkeeping / accounting ──
  "quickbooks online": ["quickbooks", "quick books", "qbo", "qb online", "intuit quickbooks"],
  xero: ["xero accounting"],
  "sage accounting": ["sage", "sage 50", "sage intacct"],
  freshbooks: ["fresh books"],
  wave: ["wave accounting"],
  netsuite: ["net suite", "oracle netsuite"],
  "bill.com": ["billcom", "bill com"],
  gusto: [],
  "a2x": ["a2x accounting"],
  dext: ["receipt bank", "receiptbank"],

  // ── Ecommerce ──
  shopify: ["shopify plus"],
  woocommerce: ["woo commerce", "woo"],
  bigcommerce: ["big commerce"],
  "amazon seller central": ["seller central", "amazon fba", "fba"],
  shipstation: ["ship station"],
  "amazon ppc": ["amazon advertising", "amazon ads", "amazon sponsored ads", "sponsored products"],
  "helium 10": ["helium10", "helium ten"],
  "jungle scout": ["junglescout"],
  klaviyo: [],

  // ── Helpdesk / support ──
  gorgias: [],
  zendesk: ["zen desk", "zendesk support"],
  freshdesk: ["fresh desk"],
  intercom: [],
  "help scout": ["helpscout"],
  reamaze: ["re amaze", "re:amaze"],
  livechat: ["live chat"],

  // ── Dental / medical PMS ──
  dentrix: ["dentrix ascend", "dentrix enterprise"],
  eaglesoft: ["eagle soft"],
  "open dental": ["opendental"],
  curve: ["curve dental"],
  epic: ["epic emr", "epic systems"],
  "athenahealth": ["athena health", "athena"],
  "dr chrono": ["drchrono"],
  "simple practice": ["simplepractice"],

  // ── Dev / engineering ──
  react: ["reactjs", "react.js", "react js"],
  "react native": ["reactnative", "react-native"],
  typescript: ["type script"],
  javascript: ["java script", "ecmascript", "es6"],
  "node.js": ["node", "nodejs", "node js"],
  "next.js": ["nextjs", "next js"],
  "vue.js": ["vue", "vuejs", "vue js"],
  postgresql: ["postgres", "postgre", "psql", "postgre sql"],
  mysql: ["my sql"],
  mongodb: ["mongo", "mongo db"],
  "tailwind css": ["tailwind", "tailwindcss"],
  "python": ["python3"],
  django: [],
  "graphql": ["graph ql"],
  "aws": ["amazon web services"],
  docker: [],
  kubernetes: ["k8s"],

  // ── CRM / marketing ──
  hubspot: ["hub spot"],
  salesforce: ["sfdc", "sales force"],
  "go high level": ["gohighlevel", "ghl", "highlevel"],
  "active campaign": ["activecampaign"],
  mailchimp: ["mail chimp"],
  "google ads": ["adwords", "google adwords"],
  "meta ads": ["facebook ads", "fb ads", "meta business suite", "facebook business manager"],
  "google analytics": ["ga4", "google analytics 4"],

  // ── PM / comms / ops ──
  slack: [],
  asana: [],
  trello: [],
  notion: [],
  clickup: ["click up"],
  monday: ["monday.com", "monday com"],
  jira: ["atlassian jira"],
  "google workspace": ["gsuite", "g suite", "google suite", "gmail"],
  "microsoft excel": ["excel", "ms excel", "msexcel"],
  "microsoft office": ["ms office", "office 365", "microsoft 365"],
  canva: [],
  calendly: [],
  loom: [],
  airtable: ["air table"],
  zapier: [],
  make: ["integromat"],
};

/** variant → canonical, built once from GROUPS. Canonicals map to themselves. */
const ALIASES: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(GROUPS)) {
    m.set(canonical, canonical);
    for (const v of variants) {
      // A variant colliding across two canonicals is a seeding bug, not a
      // runtime condition — fail loud in dev rather than pick a silent winner.
      if (m.has(v) && m.get(v) !== canonical) {
        throw new Error(`tool alias "${v}" maps to both "${m.get(v)}" and "${canonical}"`);
      }
      m.set(v, canonical);
    }
  }
  return m;
})();

/**
 * Maps an already-normalized tool name to its canonical form, or returns it
 * unchanged when unknown. Input is expected to be normalizeSkill output.
 */
export function canonicalizeTool(normalized: string): string {
  return ALIASES.get(normalized) ?? normalized;
}

/**
 * Whether the table knows this normalized name at all — as a canonical or an
 * alias. Distinct from `canonicalizeTool(x) !== x`, which is only true for
 * aliases and reports every canonical (salesforce, zendesk) as unknown.
 */
export function isKnownTool(normalized: string): boolean {
  return ALIASES.has(normalized);
}

/** Test/analysis hook: how many distinct tools the table currently knows. */
export const KNOWN_TOOL_COUNT = new Set(ALIASES.values()).size;
