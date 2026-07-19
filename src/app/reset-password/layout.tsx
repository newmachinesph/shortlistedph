import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

// The page itself is a Client Component, so the noindex lives here.
export const metadata: Metadata = { title: "Choose a new password", ...NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
