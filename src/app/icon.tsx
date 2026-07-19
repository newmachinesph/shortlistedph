import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri()} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
