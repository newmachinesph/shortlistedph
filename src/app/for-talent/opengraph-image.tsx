import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "shortlisted.ph for talent — never write another application.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return renderOgImage({
    eyebrow: "For talent",
    title: "Never write another application.",
    subtitle: "Upload a resume once. Every hidden job description is matched against it while you sleep.",
  });
}
