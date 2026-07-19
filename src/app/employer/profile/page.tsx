const stats = [
  ["Response rate", "92%"],
  ["Avg. response", "6h"],
  ["Confirmed hires", "2"],
  ["Active agreements", "1"],
];

const team = [
  { name: "Dr. Sarah Chen", role: "Practice Owner", initials: "SC" },
  { name: "Maya Rodriguez", role: "Office Manager", initials: "MR" },
];

export default function EmployerProfilePage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Company profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        No business verification required — your track record on shortlisted.ph is your reputation.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            HD
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-ink">Harbor Dental Group</h2>
            <p className="mt-1 text-ink-soft">3 clinics · Austin, TX</p>
            <p className="mt-1 text-sm text-ink-faint">Dr. Sarah Chen · Practice Owner · member since Jun 2026</p>
          </div>
          <button className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            Edit
          </button>
        </div>
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Public track record
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-faint">{label}</dt>
              <dd className="font-display mt-1.5 text-2xl font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">
          Candidates see these numbers before consenting to connect — no business verification needed; your track record is your reputation.
        </p>
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Team
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <ul className="space-y-4">
          {team.map((m) => (
            <li key={m.name} className="flex items-center gap-3">
              <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
                {m.initials}
              </span>
              <div>
                <p className="font-medium text-ink">{m.name}</p>
                <p className="text-sm text-ink-soft">{m.role}</p>
              </div>
            </li>
          ))}
        </ul>
        <button className="mt-5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          Invite teammate
        </button>
      </div>
    </>
  );
}
