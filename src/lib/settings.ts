import "server-only";
import { db } from "./db";

/**
 * Operator switches, stored as key-value rows. The only consumer contract:
 * a missing key means the default, never an error.
 */

/** "off" suppresses all non-auth email; missing or anything else means on. */
export const OUTREACH_EMAILS_KEY = "outreach_emails";

/** "on" serves the public site as a maintenance page; missing or anything else means off. */
export const MAINTENANCE_MODE_KEY = "maintenance_mode";

/**
 * "off" drops real talent photos from public marketing pages; missing or
 * anything else means on.
 *
 * Faces only, never with a name, city, or headline attached — `visibility`
 * is consent to be matched, and this switch exists so that consent is never
 * quietly stretched into a public endorsement.
 */
export const SHOWCASE_AVATARS_KEY = "showcase_avatars";

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function outreachEmailsEnabled(): Promise<boolean> {
  return (await getSetting(OUTREACH_EMAILS_KEY)) !== "off";
}

export async function maintenanceModeEnabled(): Promise<boolean> {
  return (await getSetting(MAINTENANCE_MODE_KEY)) === "on";
}

export async function showcaseAvatarsEnabled(): Promise<boolean> {
  return (await getSetting(SHOWCASE_AVATARS_KEY)) !== "off";
}
