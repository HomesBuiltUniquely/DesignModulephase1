export function renderTenPercentPaymentRequestEmail(params: {
  customerName: string;
  projectId?: string;
  propertyType?: string;
  amountDue?: string;
  dueDate?: string;
}) {
  const {
    customerName,
    projectId = "",
    propertyType = "",
    amountDue = "",
    dueDate = "",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Approved – Ready for Site Masking</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <!-- Header / Brand -->
      <div style="padding:36px 32px 28px 32px;text-align:center;">
        <div style="margin:0 auto 16px auto;text-align:center;">
          <div style="width:34px;height:34px;background-color:#d62323;border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px auto;">
            <span style="color:#ffffff;font-weight:700;font-size:12px;line-height:1;letter-spacing:0.04em;">HI</span>
          </div>
          <div style="font-size:32px;font-weight:600;color:#111827;line-height:1.15;letter-spacing:0.01em;text-align:center;">
            HUB Interior
          </div>
        </div>
        <div style="height:1px;background-color:#f1e4d2;margin-bottom:20px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#f6ebdd;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#4c3a26;margin-bottom:12px;">
          Design Approved
        </div>
        <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          Ready for Site Masking – 10% Milestone
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;text-align:center;">
          Hi ${customerName},
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          We’re pleased to inform you that your design has been successfully reviewed and approved under DQC 1.
          Your project is now ready to move into the Site Masking & Detailed Development stage.
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          To initiate this next step, we request the <strong>10% milestone payment</strong>.
        </p>
      </div>

      <!-- Payment summary -->
      <div style="padding:0 32px 28px 32px;background-color:#fdf7f0;">
        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">
              Payment Summary
            </p>
            <span style="display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:9999px;background-color:#fde7e5;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#d62323;">
              10% Milestone
            </span>
          </div>
          <div style="font-size:13px;color:#3b3b3b;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#7b7b7b;">Project ID:</span>
              <span style="font-weight:500;color:#111827;">${projectId}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#7b7b7b;">Property Type:</span>
              <span style="font-weight:500;color:#111827;">${propertyType}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#7b7b7b;">Payable Amount:</span>
              <span style="font-weight:600;color:#16a34a;">${amountDue}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="color:#7b7b7b;">Due Date:</span>
              <span style="font-weight:500;color:#111827;">${dueDate}</span>
            </div>
          </div>
        </div>

        <!-- Account details -->
        <div style="background-color:#ffffff;border-radius:18px;padding:18px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border:1px solid #f3e2d0;margin-bottom:22px;">
          <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#111827;">
            Bank Account Details
          </p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;font-size:12px;color:#4b5563;">
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                Company Name
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">Brightspace Creation Private Limited</p>
            </div>
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                Bank Name
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">ICICI Bank</p>
            </div>
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                Account Type
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">Current Account</p>
            </div>
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                Account Number
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">748305000519</p>
            </div>
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                IFSC Code
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">ICIC0007483</p>
            </div>
            <div>
              <p style="margin:0 0 2px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">
                Payment Reference
              </p>
              <p style="margin:0;font-weight:500;color:#111827;">${projectId ? projectId : "PROJECT"}-10PCT</p>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="#" style="display:inline-block;min-width:220px;padding:14px 32px;background-color:#d62323;color:#ffffff;font-size:14px;font-weight:600;border-radius:9999px;text-decoration:none;box-shadow:0 10px 20px rgba(214,35,35,0.35);">
            Pay 10% Now
          </a>
          <p style="margin:10px 0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
            You can also make a bank transfer using the above details and share the confirmation screenshot with your designer.
          </p>
        </div>
      </div>

      <!-- Footer / Signature -->
      <div style="padding:20px 32px 26px 32px;background-color:#ffffff;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
          Warm regards,
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">
          Team HUB Interior
        </p>
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;">
          This payment helps us lock your design scope and move into the next execution stage.
          If you have any questions about this request, please reply to this email or contact your designer directly.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
