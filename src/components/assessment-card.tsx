import type { ReactNode } from "react";
import { RECOMMENDATION_LABEL, type Recommendation } from "@/lib/interviews";

export type AssessmentView = {
  recommendation: string;
  overall: number;
  technical: number;
  communication: number;
  englishFluency: number;
  strengths: string;
  concerns: string;
  notes: string | null;
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-ink-faint">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-xs font-medium text-ink">{value}/5</span>
    </div>
  );
}

/**
 * One assessment, rendered identically for the employer who bought it and the
 * candidate it is about.
 *
 * Shared deliberately rather than by coincidence. The candidate consented to
 * being interviewed and recorded, so the assessment is their personal data;
 * the employer could read every word of it and the person in it could read
 * none. Two copies of this markup would have drifted the moment one side got a
 * new field — including `notes`, which is the free-text box most likely to be
 * quietly withheld from the person it describes.
 *
 * `footer` is the one part that legitimately differs: each side reaches the
 * recording by its own scoped, audit-logged route. Everything above it does not.
 */
export function AssessmentCard({
  assessment,
  footer,
}: {
  assessment: AssessmentView;
  footer?: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
        {RECOMMENDATION_LABEL[assessment.recommendation as Recommendation] ??
          assessment.recommendation}
      </span>

      <div className="mt-4 space-y-2">
        <ScoreBar label="Overall" value={assessment.overall} />
        <ScoreBar label="Technical" value={assessment.technical} />
        <ScoreBar label="Communication" value={assessment.communication} />
        <ScoreBar label="English fluency" value={assessment.englishFluency} />
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">Strengths</h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {assessment.strengths}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">Concerns</h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {assessment.concerns}
          </p>
        </div>
        {assessment.notes && (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">Notes</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {assessment.notes}
            </p>
          </div>
        )}
      </div>

      {footer && <div className="mt-5">{footer}</div>}
    </div>
  );
}
