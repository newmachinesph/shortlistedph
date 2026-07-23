import { NextResponse, type NextRequest } from "next/server";
import { maintenanceModeEnabled } from "@/lib/settings";

/**
 * Maintenance switch. Next 16 renamed the middleware file convention to
 * proxy; it runs on the Node.js runtime by default, so a direct Prisma read
 * is fine here. The setting is cached for ~30s so this is not a DB query per
 * request, and a DB failure fails OPEN — the site stays up.
 */

const TTL_MS = 30_000;
let cache = { on: false, at: 0 };

async function maintenanceOn(): Promise<boolean> {
  const now = Date.now();
  if (now - cache.at < TTL_MS) return cache.on;
  let on = false;
  try {
    on = await maintenanceModeEnabled();
  } catch {
    // ponytail: fail open on DB errors — serving the site beats a hard 500.
  }
  cache = { on, at: now };
  return on;
}

export async function proxy(request: NextRequest) {
  if (await maintenanceOn()) {
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Page routes only. Excluded: /api/** (webhooks + crons must never be
  // blocked), Next internals, dotted static files (favicon.ico, images, ...),
  // /admin/** (incl. /admin/login — admins keep working), and /maintenance
  // itself. Admins hitting PUBLIC pages still see the maintenance page;
  // that's accepted — they work from /admin. Note "api/" not "api": a bare
  // "api" prefix would also swallow /apply.
  matcher: ["/((?!api/|_next|admin|maintenance|.*\\..*).*)"],
};
