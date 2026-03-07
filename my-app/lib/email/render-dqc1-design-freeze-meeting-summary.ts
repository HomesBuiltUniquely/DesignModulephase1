export function renderDqc1DesignFreezeMeetingSummaryEmail(params: {
  customerName: string;
  designerName?: string;
  meetingDate?: string;
  projectId?: string;
  propertyType?: string;
}) {
  const {
    customerName,
    designerName = "Design Team",
    meetingDate = "–",
    projectId = "–",
    propertyType = "–",
  } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Freeze – Meeting Summary</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="background-color:#f5e7d6;padding:28px 32px 16px 32px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;background-color:#d62323;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#ffffff;font-weight:700;font-size:12px;">HI</span>
          </div>
          <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">HUB Interior Design</p>
        </div>
      </div>
      <div style="padding:36px 32px 32px 32px;background:linear-gradient(180deg,#5d5853 0%,#4b4540 100%);color:#ffffff;">
        <h1 style="margin:0 0 4px 0;font-size:24px;line-height:1.3;font-weight:600;">Design Freeze – Meeting Summary</h1>
        <p style="margin:0;font-size:13px;line-height:1.7;color:#f7e9d8;max-width:420px;">Solidifying your vision into reality. Thank you for your continued trust in HUB.</p>
      </div>
      <div style="padding:28px 32px 24px 32px;background-color:#ffffff;">
        <p style="margin:0 0 12px 0;font-size:13px;color:#4b4b4b;line-height:1.7;">Dear ${customerName},</p>
        <p style="margin:0;font-size:13px;color:#4b4b4b;line-height:1.7;">It was a pleasure meeting with you to finalize the design details. This summary outlines the core alignments reached during our Design Freeze discussion and the path forward for your project.</p>
      </div>
      <div style="padding:0 32px 32px 32px;background-color:#fdf7f0;">
        <div style="background-color:#f8efdf;border-radius:16px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">Key Design Decisions</p>
          <ul style="margin:0 0 0 18px;padding:0;font-size:13px;line-height:1.7;color:#3b3b3b;">
            <li style="margin-bottom:8px;">Final layout for living, dining and kitchen confirmed.</li>
            <li style="margin-bottom:8px;">Material palette and finishes frozen for all primary spaces.</li>
            <li style="margin-bottom:8px;">Loose furniture and décor direction aligned with the 3D views.</li>
          </ul>
        </div>
        <div style="background-color:#f8efdf;border-radius:16px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">Action Items &amp; Next Steps</p>
          <ul style="margin:0 0 0 18px;padding:0;font-size:13px;line-height:1.7;color:#3b3b3b;">
            <li style="margin-bottom:8px;">Share final 3D views and updated estimate document with you.</li>
            <li style="margin-bottom:8px;">Receive your written approval on the attached design set.</li>
            <li style="margin-bottom:8px;">Initiate procurement and production planning after sign-off.</li>
          </ul>
        </div>
        <div style="background-color:#f8efdf;border-radius:16px;padding:20px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:24px;">
          <p style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2b2b2b;font-weight:600;">Project Snapshot</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
            <div style="background-color:#f4e3cf;border-radius:10px;padding:8px 16px;"><p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.14em;color:#9ca3af;text-transform:uppercase;">Meeting Date</p><p style="margin:0;color:#111827;font-weight:500;">${meetingDate}</p></div>
            <div style="background-color:#f4e3cf;border-radius:10px;padding:8px 16px;"><p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.14em;color:#9ca3af;text-transform:uppercase;">Property Type</p><p style="margin:0;color:#111827;font-weight:500;">${propertyType}</p></div>
            <div style="background-color:#f4e3cf;border-radius:10px;padding:8px 16px;"><p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.14em;color:#9ca3af;text-transform:uppercase;">Project ID</p><p style="margin:0;color:#111827;font-weight:500;">${projectId}</p></div>
            <div style="background-color:#f4e3cf;border-radius:10px;padding:8px 16px;"><p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.14em;color:#9ca3af;text-transform:uppercase;">Estimate Version</p><p style="margin:0;color:#111827;font-weight:500;">R2 – Design Freeze</p></div>
          </div>
        </div>
      </div>
      <div style="padding:24px 32px 36px 32px;background-color:#ffffff;">
        <div style="text-align:center;margin-bottom:24px;">
          <a href="#" style="display:inline-block;padding:12px 36px;background-color:#d62323;color:#ffffff;font-size:14px;font-weight:600;border-radius:999px;text-decoration:none;box-shadow:0 10px 20px rgba(214,35,35,0.35);">Confirm Approval to Proceed</a>
        </div>
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#111827;">${designerName}</p>
        <p style="margin:0 0 24px 0;font-size:11px;color:#d62323;">Lead Interior Designer</p>
        <p style="margin:0;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#b3b3b3;text-align:center;">You're receiving this update as part of your active project with HUB Interior.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
