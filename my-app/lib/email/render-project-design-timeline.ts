export function renderProjectDesignTimelineEmail(params: { customerName: string; designerName?: string }) {
  const { customerName, designerName } = params;
  const finalDesignerName = (designerName || '').trim() || 'Designer';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Design Timeline – Upcoming Stages</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:32px 14px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;">
      <div style="padding:28px 32px 12px 32px;">
        <div style="text-align:center;margin-bottom:10px;">
          <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:8px;background:#d62323;color:#fff;font-size:12px;font-weight:700;letter-spacing:.04em;">HI</span>
          <span style="display:inline-block;margin-left:8px;font-size:24px;line-height:1;font-weight:600;color:#111;vertical-align:middle;">HUB Interior</span>
        </div>
        <div style="height:1px;background:#eadfce;margin:14px 0 20px;"></div>

        <h1 style="margin:0 0 8px 0;text-align:center;font-size:30px;line-height:1.25;color:#0f172a;">Project Design Timeline</h1>
        <p style="margin:0;text-align:center;font-size:17px;line-height:1.5;color:#6b7280;">
          Hi ${customerName}, your journey to a beautiful space starts here.<br/>
          Here's an overview of the key stages ahead.
        </p>
      </div>

      <div style="padding:8px 32px 24px 32px;">
        <div style="background:#f5f5f5;border-radius:20px;padding:20px 22px;">
          ${[
            ["1", "First Cut Design Presentation", "Within 2 days from receipt of site measurements"],
            ["2", "Design Freezing Meeting", "Within 2 days after the First Cut discussion"],
            ["3", "10% Payment Collection", "Within 1 day after Design Freezing"],
            ["4", "DQC 1 Submission (Internal Review)", "Same day of 10% payment confirmation"],
            ["5", "DQC 1 Approval", "Within 1 day of submission"],
            ["6", "D2 – Site Masking", "Same day or 1 day after DQC 1 approval"],
            ["7", "Color Selection Meeting", "Within 1 day after D2 completion"],
            ["8", "DQC 2 Submission", "Within 2 days from color selection"],
            ["9", "DQC 2 Approval", "Within 2 days from submission"],
            ["10", "Design Sign-Off Meeting", "Same day or 1 day after DQC 2 approval"],
            ["11", "40% Payment", "Same day or 1 day after sign-off"],
            ["12", "Customer Approval for Production", "Same day or next day of payment"],
            ["13", "Push to Production (P2P)", "Same day of production approval"],
          ]
            .map(
              ([num, title, subtitle]) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 13px 0;">
              <tr>
                <td style="width:44px;vertical-align:top;padding-top:2px;">
                  <div style="width:30px;height:30px;border-radius:9999px;background:#d62323;color:#fff;text-align:center;line-height:30px;font-size:14px;font-weight:700;">${num}</div>
                </td>
                <td style="vertical-align:top;">
                  <div style="font-size:18px;line-height:1.35;font-weight:700;color:#111827;">${title}</div>
                  <div style="font-size:14px;line-height:1.5;color:#4b5563;">${subtitle}</div>
                </td>
              </tr>
            </table>`,
            )
            .join("")}
        </div>
      </div>

      <div style="padding:0 32px 24px 32px;">
        <div style="background:#f3dfe2;border-radius:18px;padding:20px 22px;">
          <p style="margin:0 0 10px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111;">We're excited to bring your vision to life.</p>
          <p style="margin:0 0 14px 0;font-size:15px;line-height:1.5;color:#374151;">
            Our team is dedicated to crafting a space that reflects your unique style and needs.
          </p>
          <p style="margin:0 0 2px 0;font-size:14px;color:#374151;">Warmly,</p>
          <p style="margin:0 0 10px 0;font-size:14px;color:#d62323;font-weight:600;">${finalDesignerName}<br/>Team HUB</p>
          <div style="text-align:right;">
            <a href="#" style="display:inline-block;background:#e53935;color:#fff;text-decoration:none;padding:10px 22px;border-radius:9999px;font-size:13px;font-weight:700;">
              Project Dashboard →
            </a>
          </div>
        </div>
      </div>

      <div style="background:#f0ebe3;padding:18px 20px 20px;text-align:center;">
        <p style="margin:0 0 6px 0;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:#8b6f54;">
          © 2024 HUB INTERIOR DESIGN STUDIO
        </p>
        <p style="margin:0 0 4px 0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8b6f54;">
          HBR LAYOUT, BANGALORE, 1ST FLOOR, 6TH CROSS RD, 1ST STAGE, HBR LAYOUT 4TH BLOCK,<br/>
          HBR LAYOUT, BENGALURU, KARNATAKA 560044
        </p>
        <p style="margin:0;font-size:12px;">
          <a href="mailto:communication@hubinterior.com" style="color:#2563eb;text-decoration:underline;">COMMUNICATION@HUBINTERIOR.COM</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
