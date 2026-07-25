import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import {
  HARD_FILTERS_KEY,
  MAINTENANCE_MODE_KEY,
  OUTREACH_EMAILS_KEY,
  SHOWCASE_AVATARS_KEY,
  getSetting,
  setSetting,
} from "@/lib/settings";
import { requireAdmin } from "@/lib/session";

/**
 * Every switch a settings page can flip, with the value a missing row means.
 * One list, so GET and PATCH cannot disagree about which keys exist — they did:
 * PATCH took three keys, GET answered with one, and hard_filters_enabled (which
 * gates Stage 0 in the matching engine) was in neither.
 */
const SWITCHES: Record<string, "on" | "off"> = {
  [OUTREACH_EMAILS_KEY]: "on",
  [MAINTENANCE_MODE_KEY]: "off",
  [SHOWCASE_AVATARS_KEY]: "on",
  [HARD_FILTERS_KEY]: "off",
};

const Body = z.object({
  key: z.enum([OUTREACH_EMAILS_KEY, MAINTENANCE_MODE_KEY, SHOWCASE_AVATARS_KEY, HARD_FILTERS_KEY]),
  value: z.enum(["on", "off"]),
});

export async function GET() {
  try {
    await requireAdmin();
    const entries = await Promise.all(
      Object.entries(SWITCHES).map(async ([key, fallback]) => {
        const value = await getSetting(key);
        return [key, value === "on" || value === "off" ? value : fallback];
      }),
    );
    return ok(Object.fromEntries(entries));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseBody(req, Body);

    await setSetting(body.key, body.value);
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "admin.settings.update",
        target: body.key,
        meta: { value: body.value },
      },
    });

    return ok({ key: body.key, value: body.value });
  } catch (e) {
    return fail(e);
  }
}
