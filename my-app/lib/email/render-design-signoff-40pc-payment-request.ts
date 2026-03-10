export function renderDesignSignoff40pcPaymentRequestEmail(params: {
  customerName: string;
  amount?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  designerName?: string;
}) {
  const {
    customerName,
    amount = "[Amount]",
    accountName = "[Account Name]",
    accountNumber = "[Account Number]",
    ifscCode = "[IFSC Code]",
    designerName = "Team HUB Interiors",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Sign-Off Completed – 40% Milestone</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f5ee;">
  <div style="min-height:100vh;background-color:#f8f5ee;padding:48px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="padding:48px 32px 40px 32px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:15px;">
          <div style="width:30px;height:30px;background-color:#d62323;border-radius:9px;flex:0 0 auto;text-align:center;line-height:30px;">
            <span style="display:inline-block;color:#ffffff;font-weight:700;font-size:10px;line-height:1;letter-spacing:0.04em;vertical-align:middle;">HI</span>
          </div>
          <div style="text-align:left;">
            <p style="margin:0;font-size:24px;line-height:1.1;font-weight:600;color:#111827;letter-spacing:0.01em;">HUB Interior</p>
          </div>
        </div>
        <div style="width:100%;height:1px;background-color:#f1e4d2;margin:0 0 20px 0;"></div>
        <h1 style="margin:0 0 24px 0;font-size:28px;line-height:1.2;font-weight:800;color:#000;text-align:center;">
          Design Sign-Off Completed – 40% Milestone
        </h1>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Dear ${customerName},
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Thank you for your time during the Design Sign-Off discussion.
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          As aligned, the final drawings, material selections, hardware specifications, and scope have now been formally confirmed.
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We will now proceed to the next stage of your project.
        </p>
        <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          To initiate production planning and block your execution schedule, we request the 40% milestone payment.
        </p>
        <div style="background-color:#f5f2eb;border-radius:16px;padding:20px 24px;margin:0 0 20px 0;">
          <p style="margin:0 0 16px 0;font-size:17px;color:#333;">
            <strong>Payable Amount:</strong> ₹ ${amount}
          </p>
          <p style="margin:0 0 12px 0;font-size:15px;color:#333;font-weight:600;">Bank Details:</p>
          <div style="font-size:15px;color:#333;">
            <p style="margin:0 0 8px 0;"><strong>Account Name:</strong> ${accountName}</p>
            <p style="margin:0 0 8px 0;"><strong>Account Number:</strong> ${accountNumber}</p>
            <p style="margin:0;"><strong>IFSC Code:</strong> ${ifscCode}</p>
          </div>
        </div>
        <p style="margin:0 0 12px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Upon payment confirmation:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:24px;font-size:17px;line-height:1.6;color:#4a4a4a;">
          <li style="margin-bottom:8px;">Production slot will be allocated</li>
          <li style="margin-bottom:8px;">Project timeline will be activated</li>
          <li style="margin-bottom:8px;">Execution coordination will begin</li>
        </ul>
        <p style="margin:0 0 32px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Please feel free to reach out if any clarification is required.
        </p>
        <p style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#1f1f1f;">Warm regards,</p>
        <p style="margin:0;font-size:15px;color:#333;">${designerName}<br/>HUB Interiors</p>
      </div>
      <div style="background-color:#f0ebe3;border-radius:0 0 24px 24px;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this as part of your active design contract with HUB Interior.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
