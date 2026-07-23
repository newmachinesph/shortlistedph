import "server-only";
import { db } from "./db";

/**
 * Operator switches, stored as key-value rows. The only consumer contract:
 * a missing key means the default, never an error.
 */

/** "off" suppresses all non-auth email; missing or anything else means on. */
export const OUTREACH_EMAILS_KEY = "outreach_emails";

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
