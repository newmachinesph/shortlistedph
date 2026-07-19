import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

/**
 * iOS masks the icon itself, so the brand green sits behind the mark's own
 * rounded corners rather than leaving them transparent (which renders black).
 */
export default function AppleIcon() {
  const svg = readFileSync(join(process.cwd(), "src/app/icon.svg")).toString("base64");

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#306644" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${svg}`} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
