/**
 * Email renderer for New Quote Generation notification.
 * Sent internally to the Sales person (To).
 */
export function renderNewQuoteGeneratedEmail(params: {
  salesPersonName?: string;
  customerName: string;
  leadId: number | string;
  quoteId: number | string;
}) {
  const {
    salesPersonName = "Team",
    customerName,
    leadId,
    quoteId,
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Quote Generated</title>
</head>
<body style="margin:0;padding:0;background-color:#fef2f2;">
  <div style="min-height:100vh;background-color:#fef2f2;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- Header / Brand -->
      <div style="padding:40px 32px 28px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">
          <div style="width:40px;height:40px;background-color:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#ffffff;font-weight:700;font-size:18px;">📄</span>
          </div>
          <div style="text-align:left;">
            <div style="font-size:18px;font-weight:600;color:#111827;line-height:1.2;">
              HUB Interior Design
            </div>
          </div>
        </div>
        <div style="height:1px;background-color:#bfdbfe;margin-bottom:24px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#dbeafe;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#1e40af;margin-bottom:16px;">
          Quote Notification
        </div>
        <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          New Quote Generated
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;">
          Hi ${salesPersonName}, a new quote has been generated successfully for your lead.
        </p>
      </div>

      <!-- Details card -->
      <div style="padding:0 32px 32px 32px;background-color:#eff6ff;">
        <div style="background-color:#ffffff;border-radius:18px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);border:1px solid #bfdbfe;margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">
            Quote Details
          </p>
          <div style="font-size:13px;color:#3b3b3b;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Lead ID</span>
              <span style="font-weight:600;color:#111827;">${leadId}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Customer Name</span>
              <span style="font-weight:500;color:#111827;">${customerName}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="color:#7b7b7b;">Quote ID</span>
              <span style="font-weight:600;color:#111827;">${quoteId}</span>
            </div>
          </div>
        </div>

        <p style="margin:0;font-size:13px;line-height:1.7;color:#4b5563;">
          You can view the newly generated quote details in the CRM Dashboard.
        </p>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px 32px 32px;background-color:#ffffff;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
          Regards,
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">
          HUB Interior Team
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
