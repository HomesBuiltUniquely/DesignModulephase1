export function renderTenPercentPaymentApprovalEmail(params: {
  customerName: string;
  projectId?: string;
  amountPaid?: string;
  paymentDate?: string;
  transactionRef?: string;
}) {
  const {
    customerName,
    projectId = "–",
    amountPaid = "–",
    paymentDate = "–",
    transactionRef = "–",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>10% Payment Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <!-- Header / Brand -->
      <div style="padding:40px 32px 28px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;">
          <div style="width:40px;height:40px;background-color:#16a34a;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#ffffff;font-weight:700;font-size:18px;">✓</span>
          </div>
          <div style="text-align:left;">
            <div style="font-size:18px;font-weight:600;color:#111827;line-height:1.2;">
              HUB Interior Finance
            </div>
          </div>
        </div>
        <div style="height:1px;background-color:#e5f3e9;margin-bottom:24px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#e7f6ed;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#166534;margin-bottom:16px;">
          Payment Received
        </div>
        <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          10% Payment Confirmation
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;">
          Hi ${customerName}, thank you for completing your 10% design payment.
          This email is an acknowledgement of the amount received for your HUB
          Interior project.
        </p>
      </div>

      <!-- Receipt card -->
      <div style="padding:0 32px 32px 32px;background-color:#fdf7f0;">
        <div style="background-color:#ffffff;border-radius:18px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);border:1px solid #e5f0e8;margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">
            Receipt Details
          </p>
          <div style="font-size:13px;color:#3b3b3b;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Project ID</span>
              <span style="font-weight:500;color:#111827;">${projectId}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Amount Paid</span>
              <span style="font-weight:600;color:#16a34a;">${amountPaid}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span style="color:#7b7b7b;">Payment Date</span>
              <span style="font-weight:500;color:#111827;">${paymentDate}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="color:#7b7b7b;">Transaction Ref</span>
              <span style="font-weight:500;color:#111827;">${transactionRef}</span>
            </div>
          </div>
        </div>

        <p style="margin:0 0 0 0;font-size:13px;line-height:1.7;color:#4b5563;">
          Your designer will now proceed with D2 masking and the subsequent
          design activities as per the agreed timeline. You will continue to
          receive milestone updates as your project progresses.
        </p>
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
          This is an automated receipt. For any clarifications related to your
          payment, please write to finance@hubinterior.com and mention your
          project ID in the subject line.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
