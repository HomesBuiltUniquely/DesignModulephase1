export function renderDesignSignoffMeetingScheduledEmail(params: {
  customerName: string;
  meetingDate?: string;
  meetingTime?: string;
  designerName?: string;
}) {
  const {
    customerName,
    meetingDate = "[Date]",
    meetingTime = "[Time]",
    designerName = "Design Team",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Approved – Let's Schedule Final Sign-Off</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f5ee;">
  <div style="min-height:100vh;background-color:#f8f5ee;padding:48px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="padding:48px 32px 40px 32px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:15px;">
          <div style="width:36px;height:40px;">
            <div style="width:36px;height:40px;background-color:#da4b3a;clip-path:polygon(18px 0, 36px 40px, 0 40px);"></div>
          </div>
          <div style="text-align:center;">
            <p style="margin:0;font-size:16px;letter-spacing:0.08em;color:#333333;text-transform:uppercase;">HUB Interior</p>
            <div style="width:70px;height:1px;background-color:#d4d4d4;margin:8px auto 0;"></div>
          </div>
        </div>
        <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.2;font-weight:800;color:#000;text-align:center;">
          Design Approved – Let's Schedule Final Sign-Off
        </h1>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          Dear ${customerName},
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We're pleased to inform you that your project has successfully cleared the DQC 2 review.
        </p>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          All final design details, laminate selections, and technical alignments have been validated.
        </p>
        <p style="margin:0 0 16px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We are now ready to proceed with the Design Sign-Off meeting, where we will:
        </p>
        <ul style="margin:0 0 20px 0;padding-left:24px;font-size:17px;line-height:1.6;color:#4a4a4a;">
          <li style="margin-bottom:8px;">Review the final drawings</li>
          <li style="margin-bottom:8px;">Confirm scope and specifications</li>
          <li style="margin-bottom:8px;">Align on the final estimate</li>
          <li style="margin-bottom:8px;">Initiate the next milestone</li>
        </ul>
        <div style="background-color:#f5f2eb;border-radius:16px;padding:20px 24px;margin:0 0 20px 0;">
          <p style="margin:0 0 8px 0;font-size:15px;color:#333;">
            <strong>📅 Proposed Date:</strong> ${meetingDate}
          </p>
          <p style="margin:0;font-size:15px;color:#333;">
            <strong>🕒 Time:</strong> ${meetingTime}
          </p>
        </div>
        <p style="margin:0 0 20px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          I hope this schedule works for you. Please let me know if any adjustment is required.
        </p>
        <p style="margin:0 0 32px 0;font-size:17px;line-height:1.6;color:#4a4a4a;">
          We're now at the final design stage before moving towards production, after 40% payment.
        </p>
        <p style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#1f1f1f;">Warm regards,</p>
        <p style="margin:0;font-size:15px;color:#333;">${designerName}<br/>HUB Interiors</p>
      </div>
      <div style="background-color:#f0ebe3;border-radius:0 0 24px 24px;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">You're receiving this because your project has reached the Design Sign-Off stage.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
