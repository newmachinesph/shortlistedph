/**
 * The controlled vocabularies the openings board filters on. Small and pure so
 * both the board page and the admin "list publicly" control share one source —
 * a role family the admin can't pick is a filter that can never match.
 *
 * Labels are what the public sees; the value is what's stored on the JD column.
 */

export const ROLE_FAMILIES: { value: string; label: string }[] = [
  { value: "ecommerce_ops", label: "Ecommerce ops" },
  { value: "customer_support", label: "Customer support" },
  { value: "bookkeeping", label: "Bookkeeping & accounting" },
  { value: "executive_va", label: "Executive VA" },
  { value: "sales_marketing", label: "Sales & marketing" },
  { value: "creative_design", label: "Creative & design" },
  { value: "engineering", label: "Engineering" },
  { value: "healthcare_va", label: "Healthcare VA" },
  { value: "operations", label: "Operations & PM" },
];

export const CLIENT_REGIONS: { value: string; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "UK", label: "United Kingdom" },
  { value: "EU", label: "Europe" },
  { value: "AU", label: "Australia / NZ" },
];

const roleLabels = new Map(ROLE_FAMILIES.map((r) => [r.value, r.label]));
const regionLabels = new Map(CLIENT_REGIONS.map((r) => [r.value, r.label]));

/** Value → label, falling back to the raw value so an unknown never renders blank. */
export const roleFamilyLabel = (v: string | null): string | null =>
  v ? (roleLabels.get(v) ?? v) : null;
export const clientRegionLabel = (v: string | null): string | null =>
  v ? (regionLabels.get(v) ?? v) : null;
