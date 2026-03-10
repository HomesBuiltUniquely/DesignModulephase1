export function renderDqc2MaterialSelectionScheduledEmail(params: {
  customerName: string;
  designerName?: string;
  meetingDate?: string | null;
  meetingTime?: string | null;
  ecLocation?: string | null;
}) {
  const {
    customerName,
    designerName = "Designer",
    meetingDate = "–",
    meetingTime = "–",
    ecLocation = "–",
  } = params;

  const subject = "Color & Material Selection Meeting – Scheduled";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <!-- Header / Brand -->
      <div style="padding:36px 32px 28px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-bottom:18px;">
          <div style="width:30px;height:30px;background-color:#d62323;border-radius:9px;flex:0 0 auto;text-align:center;line-height:30px;">
            <span style="display:inline-block;color:#ffffff;font-weight:700;font-size:10px;line-height:1;letter-spacing:0.04em;vertical-align:middle;">HI</span>
          </div>
          <div style="text-align:left;font-size:24px;font-weight:600;color:#111827;line-height:1.1;letter-spacing:0.01em;">
            HUB Interior
          </div>
        </div>
        <div style="height:1px;background-color:#f1e4d2;margin-bottom:18px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#f6ebdd;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#4c3a26;margin-bottom:12px;">
          DQC 2
        </div>
        <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          Color & Material Selection Meeting – Scheduled
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;">
          Dear ${customerName},
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          As the D2 stage has been completed, we are now ready to proceed with the Color &amp; Material Selection discussion.
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          Let&apos;s connect at our Experience Center to finalise finishes and material selections.
        </p>
      </div>

      <!-- Date, Time, Location -->
      <div style="padding:0 32px 20px 32px;background-color:#fdf7f0;">
        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:20px;">
          <div style="font-size:13px;color:#3b3b3b;line-height:1.8;">
            <p style="margin:0 0 8px 0;">📅 Date: ${meetingDate}</p>
            <p style="margin:0 0 8px 0;">🕒 Time: ${meetingTime}</p>
            <p style="margin:0;">📍 Location: ${ecLocation}</p>
          </div>
        </div>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#4b5563;">
          During this meeting, we will:
        </p>
        <ul style="margin:0 0 12px 18px;padding:0;font-size:14px;line-height:1.7;color:#4b5563;">
          <li style="margin-bottom:6px;">Finalise laminate and finish selections</li>
          <li style="margin-bottom:6px;">Align shutter finishes and internal materials</li>
          <li style="margin-bottom:6px;">Confirm accessory preferences</li>
        </ul>
        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#4b5563;">
          I hope this schedule works for you. In case of any constraints, please feel free to let me know.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;font-weight:500;">
          Looking forward to finalising the details together.
        </p>
      </div>

      <!-- Footer / Signature -->
      <div style="padding:20px 32px 26px 32px;background-color:#ffffff;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">
          Warm regards,
        </p>
        <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:#111827;">
          ${designerName}
        </p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">
          Team HUB
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
