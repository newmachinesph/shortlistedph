import { Avatar } from "./avatar";

/**
 * Overlapping row of talent photos with a caption. Decorative: no names are
 * passed in, so none reach the page source — see lib/talent-showcase.ts.
 *
 * The ring radius has to track the Avatar radius or the halo corners cut into
 * the photo, so the two are mapped together here rather than guessed.
 */
const ring = { sm: "rounded-lg", md: "rounded-xl" } as const;

export function AvatarCluster({
  images,
  caption,
  size = "md",
}: {
  images: string[];
  caption?: string;
  size?: "sm" | "md";
}) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex -space-x-2.5">
        {images.map((src) => (
          <span key={src} className={`${ring[size]} ring-2 ring-paper`}>
            <Avatar name="" image={src} size={size} />
          </span>
        ))}
      </div>
      {caption && <p className="text-sm text-ink-soft">{caption}</p>}
    </div>
  );
}
