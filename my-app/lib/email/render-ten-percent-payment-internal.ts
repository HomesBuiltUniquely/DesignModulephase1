export function renderTenPercentPaymentInternalEmail(params: {
  customerName: string;
  designerName: string;
  ecName: string;
}) {
  const { customerName, designerName, ecName } = params;

  const subject = "DQC 1 Approved – Proceed with 10% Collection & Masking";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#fee2e2,#fef3c7);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:9999px;background-color:#dc2626;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(220,38,38,0.45);">
                  <span style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">HI</span>
                </div>
                <div>
                  <div style="font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:#111827;font-weight:600;">
                    HUB INTERIOR
                  </div>
                  <div style="margin-top:4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#b91c1c;">
                    DQC 1 Approved
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 8px 28px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;">
                Dear <span style="font-weight:600;">${designerName}</span>,
              </p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                DQC 1 for the below project has been successfully approved.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px 0;background-color:#f9fafb;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 18px 10px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#374151;">
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;width:40%;">Project Name</td>
                        <td style="padding:4px 0;font-weight:600;color:#111827;">${customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;">Experience Center</td>
                        <td style="padding:4px 0;font-weight:500;color:#111827;">${ecName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 6px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Please proceed with the 10% milestone collection from the customer.
              </p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Once payment is confirmed, raise the D2 – Site Masking request in ERP and schedule the activity accordingly.
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#b91c1c;font-weight:500;">
                Kindly ensure there is no delay between payment confirmation and masking initiation.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 20px 28px;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">
                Regards,
              </p>
              <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#111827;">
                HUB Interior Team
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 20px 16px 20px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                Internal notification – 10% collection and D2 masking to be initiated post payment confirmation.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

