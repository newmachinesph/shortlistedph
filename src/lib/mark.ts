import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * public/mark.svg is the only copy of the logo mark. Icons and OG images all
 * rasterise it from here, so the geometry can never drift between them.
 *
 * Read at build time — every route that calls this is statically generated.
 */
export function markDataUri(): string {
  const svg = readFileSync(join(process.cwd(), "public/mark.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}
