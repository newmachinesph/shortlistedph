"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

/**
 * The one avatar shape: a square chip with rounded corners, matching the
 * workspace dashboard look. Client so a broken/unreachable image URL falls
 * back to the initials chip instead of a broken-image icon.
 */

const sizes = {
  sm: "h-8 w-8 rounded-lg text-xs",
  md: "h-10 w-10 rounded-xl text-sm",
  lg: "h-16 w-16 rounded-2xl text-xl",
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

  return image && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${sizes[size]} shrink-0 border border-line object-cover`}
    />
  ) : (
    <span
      className={`font-display flex ${sizes[size]} shrink-0 items-center justify-center bg-brand-soft font-semibold text-brand`}
    >
      {initials(name)}
    </span>
  );
}
