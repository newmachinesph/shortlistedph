import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const PAPER = "#fafcfd";
const INK = "#17201b";
const INK_SOFT = "#51605a";
const BRAND = "#306644";
const EMBER = "#a4491a";
const LINE = "#e3e9e5";

/**
 * The favicon is the only copy of the mark. Inlining it as a data URI keeps
 * one source of truth and needs no network at build time.
 */
function markDataUri(): string {
  const svg = readFileSync(join(process.cwd(), "src/app/icon.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/**
 * Space Grotesk from Google, fetched once per build. Satori only ships a
 * regular weight, so without this the headline renders unbolded. A network
 * failure falls back to that default rather than breaking the build.
 */
async function loadDisplayFont(weight: 500 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = /src: url\((.+?)\) format/.exec(css)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** Five stacked rows standing in for a ranked slate — the product, as a glyph. */
function SlateMotif() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: 300,
            padding: "14px 16px",
            borderRadius: 16,
            border: `1px solid ${LINE}`,
            background: "#ffffff",
            opacity: 1 - i * 0.17,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 34,
              height: 34,
              borderRadius: 10,
              background: i === 0 ? BRAND : "#eaf2ed",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", width: 150 - i * 14, height: 9, borderRadius: 5, background: "#c8d3cc" }} />
            <div style={{ display: "flex", width: 96 - i * 10, height: 7, borderRadius: 4, background: LINE }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type OgInput = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export async function renderOgImage({ eyebrow, title, subtitle }: OgInput) {
  const [medium, bold] = await Promise.all([loadDisplayFont(500), loadDisplayFont(700)]);

  const fonts = [
    medium && { name: "Space Grotesk", data: medium, weight: 500 as const, style: "normal" as const },
    bold && { name: "Space Grotesk", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: PAPER,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        <div style={{ display: "flex", flex: 1, padding: "64px 72px", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={markDataUri()} width={64} height={64} alt="" />
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: INK }}>
                <span>shortlisted</span>
                <span style={{ color: BRAND }}>.ph</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: EMBER,
                }}
              >
                {eyebrow}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 20,
                  fontSize: 68,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: -2,
                  color: INK,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  maxWidth: 620,
                  fontSize: 26,
                  lineHeight: 1.4,
                  color: INK_SOFT,
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <SlateMotif />
          </div>
        </div>

        <div style={{ display: "flex", height: 16, width: "100%", background: BRAND }} />
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
