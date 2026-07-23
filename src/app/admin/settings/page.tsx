import type { Metadata } from "next";
import { MailX } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { OUTREACH_EMAILS_KEY, outreachEmailsEnabled } from "@/lib/settings";
import { SettingToggle } from "./toggle";

export const metadata: Metadata = { title: "Admin · Settings", ...NOINDEX };

export default async function AdminSettings() {
  const outreachOn = await outreachEmailsEnabled();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">Platform switches. Every change is audit-logged.</p>

      <div className="mt-7 rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start gap-4 px-4 py-5 sm:px-6">
          <MailX className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-medium text-ink">Candidate &amp; outreach emails</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              Off = Only sign-in emails (verification, password reset) are delivered. Everything
              else is suppressed — use while testing so real people don&rsquo;t get mail.
            </p>
          </div>
          <SettingToggle settingKey={OUTREACH_EMAILS_KEY} enabled={outreachOn} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        In-app notifications are never suppressed — only email delivery.
      </p>
    </>
  );
}
