export function renderDesignSignoff40pcPaymentApprovalEmail(params: {
  customerName: string;
  projectName?: string;
  amountReceived?: string;
  dateOfReceipt?: string;
  modeOfPayment?: string;
}) {
  const {
    customerName,
    projectName = "[Customer Name / Property Name]",
    amountReceived = "[Amount]",
    dateOfReceipt = "[Date]",
    modeOfPayment = "[Mode]",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Receipt – 40% Milestone</title>
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
          Payment Receipt – 40% Milestone
        </h1>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Dear ${customerName},
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We acknowledge receipt of your 40% milestone payment for the below project:
        </p>
        <div style="background-color:#f5f2eb;border-radius:16px;padding:20px 24px;margin:0 0 20px 0;">
          <p style="margin:0 0 12px 0;font-size:15px;color:#333;">
            <strong>Project Name:</strong> ${projectName}
          </p>
          <p style="margin:0 0 12px 0;font-size:15px;color:#333;">
            <strong>Amount Received:</strong> ₹ ${amountReceived}
          </p>
          <p style="margin:0 0 12px 0;font-size:15px;color:#333;">
            <strong>Date of Receipt:</strong> ${dateOfReceipt}
          </p>
          <p style="margin:0;font-size:15px;color:#333;">
            <strong>Mode of Payment:</strong> ${modeOfPayment}
          </p>
        </div>
        <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Please find the official receipt attached for your reference.
        </p>
        <p style="margin:0 0 12px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          With this confirmation, we will now proceed with:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:24px;font-size:17px;line-height:1.6;color:#4a4a4a;">
          <li style="margin-bottom:8px;">Production planning</li>
          <li style="margin-bottom:8px;">Timeline activation</li>
          <li style="margin-bottom:8px;">Allocation of execution team</li>
        </ul>
        <p style="margin:0 0 32px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Thank you for your prompt support.
        </p>
        <p style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#1f1f1f;">Warm regards,</p>
        <p style="margin:0;font-size:15px;color:#333;">Finance Team<br/>HUB Interiors</p>
      </div>
      <div style="background-color:#f0ebe3;border-radius:0 0 24px 24px;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this as confirmation of your 40% milestone payment with HUB Interior.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
