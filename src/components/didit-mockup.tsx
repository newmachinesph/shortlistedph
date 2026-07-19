import { Clock, FileCheck2, IdCard, ListChecks, MapPin, ScanFace } from "lucide-react";

const steps = [
  { icon: IdCard, label: "ID verification", note: "PhilID, driver's licence or passport" },
  { icon: ScanFace, label: "Face verification", note: "a selfie, matched to your ID photo" },
  { icon: MapPin, label: "Proof of address", note: "optional" },
  { icon: FileCheck2, label: "Documents", note: "optional" },
  { icon: ListChecks, label: "Questionnaire", note: "a few short questions" },
];

/**
 * Rebuild of the Didit verification screen rather than a screenshot: stays sharp
 * at any size, weighs about 2KB, and follows the theme.
 */
export function DiditMockup() {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="rounded-[2.25rem] border-[10px] border-ink bg-ink p-0 shadow-2xl shadow-ink/20">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-white">
          <div className="absolute left-1/2 top-2 h-1 w-16 -translate-x-1/2 rounded-full bg-ink/15" />

          <div className="px-6 pt-9 pb-7 text-center">
            <p className="font-display text-sm font-semibold tracking-tight text-ink">
              <span className="text-brand">◯</span> Didit
            </p>
            <h3 className="font-display mt-5 text-lg font-semibold tracking-tight text-ink">
              Identity Verification
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              Complete these steps to verify your identity
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft">
              <Clock className="h-3 w-3" /> Approx. 4 min
            </span>

            <ul className="mt-6 space-y-3.5 text-left">
              {steps.map((s) => (
                <li key={s.label} className="flex items-start gap-3">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight text-ink">
                      {s.label}
                    </span>
                    <span className="block text-[11px] leading-tight text-ink-faint">{s.note}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white">
              Continue
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
              Didit uses facial recognition and records your session video to verify your
              identity.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
        What verification looks like. It runs on Didit, not on us, and takes about four minutes.
      </p>
    </div>
  );
}
