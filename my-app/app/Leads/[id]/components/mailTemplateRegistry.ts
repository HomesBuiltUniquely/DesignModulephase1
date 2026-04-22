/**
 * Index of visual mail templates (Next.js preview pages under `app/mail-templates/mail-templates`).
 * Keep these routes when refactoring — they are the canonical HTML references for ops.
 * Programmatic senders live under `lib/email/render-*.ts` and `app/api/email/send-*`.
 */
export const MAIL_TEMPLATE_PREVIEW_ROUTES = [
  "/mail-templates/mail-templates/d1-site-measurement",
  "/mail-templates/mail-templates/d1-mmt-visit-scheduled",
  "/mail-templates/mail-templates/dqc1-first-cut-design-scheduled",
  "/mail-templates/mail-templates/dqc1-design-freezing-scheduled",
  "/mail-templates/mail-templates/dqc1-design-freeze-meeting-summary",
  "/mail-templates/mail-templates/project-design-timeline",
  "/mail-templates/mail-templates/ten-percent-payment-request",
  "/mail-templates/mail-templates/ten-percent-payment-approval",
  "/mail-templates/mail-templates/d2-masking-request",
  "/mail-templates/mail-templates/dqc2-material-selection-scheduled",
  "/mail-templates/mail-templates/design-signoff-meeting-scheduled",
  "/mail-templates/mail-templates/design-signoff-40pc-payment-request",
  "/mail-templates/mail-templates/design-signoff-40pc-payment-approval",
  "/mail-templates/mail-templates/production-approval-request",
  "/mail-templates/mail-templates/production-poc-timeline",
] as const;
