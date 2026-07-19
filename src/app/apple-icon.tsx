import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

/**
 * iOS masks the icon and fills anything transparent with black, so the mark's
 * own paper background is painted edge to edge behind it.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fafcfd" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri()} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
