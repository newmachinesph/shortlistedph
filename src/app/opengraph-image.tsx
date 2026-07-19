import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "shortlisted.ph — write a hidden job description, get a ranked shortlist of Filipino remote talent.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return renderOgImage({
    eyebrow: "Philippine remote talent",
    title: "Don't post a job ad. Get a shortlist.",
    subtitle: "Tell us who you need. We rank the market against it and hand you five people.",
  });
}
