/**
 * Email renderer for Sales Closure Payment Rejection notification.
 * Sent internally to the Sales person (To) with Sales Lead and SPOC in CC.
 *
 * Context:
 * - Finance rejects the payment screenshot on the Sales Closure form.
 * - Sales person must re-upload a correct payment screenshot via the Sales Closure form.
 */
export function renderSalesClosurePaymentRejectedEmail(params: {
  salesPersonName?: string;
  customerName: string;
  leadId: number | string;
}) {
  const {
    salesPersonName = "Team",
    customerName,
    leadId,
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Closure Payment Rejected</title>
</head>
<body style="margin:0;padding:0;background-color:#fef2f2;">
  <div style="min-height:100vh;background-color:#fef2f2;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- Header / Brand -->
      <div style="padding:40px 32px 28px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">
          <div style="width:40px;height:40px;background-color:#dc2626;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#ffffff;font-weight:700;font-size:18px;">✕</span>
          </div>
          <div style="text-align:left;">
            <div style="font-size:18px;font-weight:600;color:#111827;line-height:1.2;">
              HUB Interior Finance
            </div>
          </div>
        </div>
        <div style="height:1px;background-color:#fecaca;margin-bottom:24px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#fee2e2;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#991b1b;margin-bottom:16px;">
          Action Required
        </div>
        <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          Payment Rejected
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;">
          Hi ${salesPersonName}, the payment screenshot you submitted for the sales closure has been reviewed and <strong style="color:#dc2626;">rejected</strong> by the Finance team.
        </p>
      </div>

      <!-- Details card -->
      <div style="padding:0 32px 32px 32px;background-color:#fff7f7;">
        <div style="background-color:#ffffff;border-radius:18px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);border:1px solid #fecaca;margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">
            Submission Details
          </p>
          <div style="font-size:13px;color:#3b3b3b;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Lead ID</span>
              <span style="font-weight:600;color:#111827;">${leadId}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="color:#7b7b7b;">Customer Name</span>
              <span style="font-weight:500;color:#111827;">${customerName}</span>
            </div>
          </div>
        </div>

        <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;line-height:1.7;color:#7f1d1d;">
            <strong>Next steps:</strong> Please reach out to the Finance team for clarification, or re-upload the correct payment screenshot via the Sales Closure form using the same Lead ID. Your submission will be reviewed again by Finance.
          </p>
        </div>

        <p style="margin:0;font-size:13px;line-height:1.7;color:#4b5563;">
          If you believe this rejection was made in error, please contact the Finance team directly and reference Lead ID <strong>${leadId}</strong>.
        </p>

        {/* Search Instruction */}
        <div style="margin-top:20px;padding:12px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#1e40af;font-weight:500;">
            Note: In the Sales Closure form, please search using the given <strong>Lead ID (#${leadId})</strong> to fetch and re-submit your data.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px 32px 32px;background-color:#ffffff;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
          Regards,
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">
          Finance Team, HUB Interior
        </p>
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;">
          This is an automated notification. For any clarifications, please write to finance@hubinterior.com and mention your Lead ID in the subject line.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
