import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

// Onboarding is never a search result — an unpublished draft profile least of all.
export const metadata: Metadata = { title: "Set up your profile", ...NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
