export function renderProductionApprovalRequestEmail(params: {
  customerName: string;
  designerName?: string;
}) {
  const {
    customerName,
    designerName = "Team HUB Interiors",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Final Approval Required – Production Initiation</title>
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
          Final Approval Required – Production Initiation
        </h1>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Dear ${customerName},
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          With the 40% milestone successfully completed, your project is now ready to move into the production phase.
        </p>
        <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Before we initiate manufacturing, we request your formal approval on the final design package, which includes:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:24px;font-size:17px;line-height:1.6;color:#4a4a4a;">
          <li style="margin-bottom:8px;">Final drawings</li>
          <li style="margin-bottom:8px;">Material and laminate selections</li>
          <li style="margin-bottom:8px;">Hardware specifications</li>
          <li style="margin-bottom:8px;">Final estimate</li>
          <li style="margin-bottom:8px;">Works contract</li>
        </ul>
        <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Please review the attached documents and confirm your approval by replying to this email with:
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;font-style:italic;">
          &ldquo;Approved for Production&rdquo;
        </p>
        <p style="margin:0 0 12px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Upon receiving your confirmation:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:24px;font-size:17px;line-height:1.6;color:#4a4a4a;">
          <li style="margin-bottom:8px;">Manufacturing will be initiated</li>
          <li style="margin-bottom:8px;">Execution timeline will be activated</li>
          <li style="margin-bottom:8px;">Your dedicated project POC will be assigned</li>
        </ul>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Kindly note that once production begins, scope or design changes may not be feasible without a formal change request.
        </p>
        <p style="margin:0 0 32px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We look forward to your confirmation.
        </p>
        <p style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#1f1f1f;">Warm regards,</p>
        <p style="margin:0;font-size:15px;color:#333;">${designerName}<br/>HUB Interiors</p>
      </div>
      <div style="background-color:#f0ebe3;border-radius:0 0 24px 24px;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this because your project has reached the production approval stage.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
