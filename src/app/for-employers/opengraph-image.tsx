import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "shortlisted.ph for employers — stop reading 400 applications.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return renderOgImage({
    eyebrow: "For employers",
    title: "Stop reading 400 applications.",
    subtitle: "Write it honestly, budget included. Candidates never see it, so nobody can write back to it.",
  });
}
