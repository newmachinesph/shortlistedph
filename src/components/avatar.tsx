"use client";

import { useState } from "react";
import Image from "next/image";
import { initials } from "@/lib/format";

/**
 * The one avatar shape: a square chip with rounded corners, matching the
 * workspace dashboard look. Client so a broken/unreachable image URL falls
 * back to the initials chip instead of a broken-image icon. Photos go through
 * next/image (resized/AVIF, lazy) — see next.config images.remotePatterns.
 */

const sizes = {
  sm: { cls: "h-8 w-8 rounded-lg text-xs", px: 32 },
  md: { cls: "h-10 w-10 rounded-xl text-sm", px: 40 },
  lg: { cls: "h-16 w-16 rounded-2xl text-xl", px: 64 },
} as const;

export function Avatar({
  name,
  image = null,
  size = "md",
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const s = sizes[size];

  return image && !failed ? (
    <Image
      src={image}
      alt=""
      width={s.px}
      height={s.px}
      onError={() => setFailed(true)}
      className={`${s.cls} shrink-0 border border-line object-cover`}
    />
  ) : (
    <span
      className={`font-display flex ${s.cls} shrink-0 items-center justify-center bg-brand-soft font-semibold text-brand`}
    >
      {initials(name)}
    </span>
  );
}
