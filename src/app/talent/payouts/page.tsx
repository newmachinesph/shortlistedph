import { permanentRedirect } from "next/navigation";

/**
 * The dashboard moved to /referrals once referring stopped being talent-only.
 * Kept as a redirect so links already shared and bookmarks still work.
 */
export default function TalentPayoutsPage() {
  permanentRedirect("/referrals");
}
