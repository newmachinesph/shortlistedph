import type { Metadata } from "next";
import { Construction, Filter, MailX, UsersRound } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requireAdminPage } from "@/lib/admin";
import {
  HARD_FILTERS_KEY,
  MAINTENANCE_MODE_KEY,
  OUTREACH_EMAILS_KEY,
  SHOWCASE_AVATARS_KEY,
  hardFiltersEnabled,
  maintenanceModeEnabled,
  outreachEmailsEnabled,
  showcaseAvatarsEnabled,
} from "@/lib/settings";
import { SettingToggle } from "./toggle";

export const metadata: Metadata = { title: "Admin · Settings", ...NOINDEX };

export default async function AdminSettings() {
  await requireAdminPage();
  const outreachOn = await outreachEmailsEnabled();
  const maintenanceOn = await maintenanceModeEnabled();
  const showcaseOn = await showcaseAvatarsEnabled();
  const hardFiltersOn = await hardFiltersEnabled();

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

      <div className="mt-5 rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start gap-4 px-4 py-5 sm:px-6">
          <Construction className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-medium text-ink">Maintenance mode</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              On = The public site shows a maintenance page. Admin (/admin) and sign-in for
              admins keep working.
            </p>
          </div>
          <SettingToggle settingKey={MAINTENANCE_MODE_KEY} enabled={maintenanceOn} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start gap-4 px-4 py-5 sm:px-6">
          <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-medium text-ink">Talent photos on public pages</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              On = Published, visible profiles&rsquo; photos appear as decoration on the
              marketing pages. Faces only — never a name, city, or headline beside them. Off
              falls back to initials chips.
            </p>
          </div>
          <SettingToggle settingKey={SHOWCASE_AVATARS_KEY} enabled={showcaseOn} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Turn this off if a talent asks not to be shown, until a per-profile opt-out exists.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start gap-4 px-4 py-5 sm:px-6">
          <Filter className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-sm font-medium text-ink">Stage 0 hard filters</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              On = Before anything is ranked, candidates are cut on metadata alone and the
              reason is recorded: rate more than 15% above the brief&rsquo;s ceiling, fewer
              free hours than the brief needs, or already booked. Off = every candidate with
              an embedding reaches the ranker and rate is only a score.
            </p>
          </div>
          <SettingToggle settingKey={HARD_FILTERS_KEY} enabled={hardFiltersOn} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        This changes who can appear on a slate. Turn it on for a brief you can re-run both
        ways and compare — elimination counts show on the slate review page.
      </p>
    </>
  );
}
