/**
 * Stand-in for @/emails/templates when the money tests run.
 *
 * Node's type stripping handles .ts but not the JSX in .tsx, and the templates
 * are the only .tsx file lib/ imports. They are React components that exist to
 * be rendered into mail bodies — nothing a refund test asserts on — so the
 * cheapest correct move is to hand the test runner components that render to
 * nothing and keep the real email module, transports and best-effort error
 * handling in the path.
 *
 * Wired up in scripts/node-resolve.mjs, and only when MONEY_TEST is set, so a
 * normal run of the app can never pick this up.
 */
const Empty = () => null;

export {
  Empty as AgreementActive,
  Empty as AgreementSigned,
  Empty as AvailabilityPrompt,
  Empty as CommissionEarned,
  Empty as ConnectionAccepted,
  Empty as ConnectionDeclined,
  Empty as ConnectionRequested,
  Empty as InterviewRequested,
  Empty as InterviewScheduled,
  Empty as InterviewerApproved,
  Empty as InterviewerRejected,
  Empty as MatchConsentRequest,
  Empty as OutcomeConfirmed,
  Empty as PaymentReceipt,
  Empty as PayoutRejected,
  Empty as PayoutSent,
  Empty as RatingReceived,
  Empty as ReactivationInvite,
  Empty as ReferralConverted,
  Empty as ResetPassword,
  Empty as SlateDelivered,
  Empty as VerifyEmail,
  Empty as WelcomeEmployer,
  Empty as WelcomeTalent,
};
