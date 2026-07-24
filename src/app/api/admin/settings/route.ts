import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import {
  MAINTENANCE_MODE_KEY,
  OUTREACH_EMAILS_KEY,
  SHOWCASE_AVATARS_KEY,
  getSetting,
  setSetting,
} from "@/lib/settings";
import { requireAdmin } from "@/lib/session";

const Body = z.object({
  key: z.enum([OUTREACH_EMAILS_KEY, MAINTENANCE_MODE_KEY, SHOWCASE_AVATARS_KEY]),
  value: z.enum(["on", "off"]),
});

export async function GET() {
  try {
    await requireAdmin();
    const value = await getSetting(OUTREACH_EMAILS_KEY);
    return ok({ [OUTREACH_EMAILS_KEY]: value === "off" ? "off" : "on" });
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
