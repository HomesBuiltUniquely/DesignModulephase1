export function renderD2MaskingRequestEmail(params: {
  customerName: string;
  designerName?: string;
  maskingDate?: string | null;
  maskingTime?: string | null;
}) {
  const {
    customerName,
    designerName = "Designer",
    maskingDate,
    maskingTime,
  } = params;

  const dateDisplay = maskingDate || "–";
  let timeDisplay = maskingTime || "–";

  if (maskingTime && maskingTime.includes(":")) {
    const [h, m] = maskingTime.split(":");
    const hours = parseInt(h, 10);
    if (!isNaN(hours)) {
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const hour12 = ((hours % 12) || 12).toString().padStart(2, '0');
      timeDisplay = `${hour12}:${m} ${suffix}`;
    }
  }

  const subject = "Site Masking Scheduled – Detailed Development Stage";

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
          D2 – Site Masking
        </div>
        <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          Site Masking Scheduled
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:480px;margin-left:auto;margin-right:auto;">
          Dear ${customerName},
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          As your 10% milestone has been completed, we are now proceeding with the D2 – Site Masking stage.
        </p>
      </div>

      <!-- Date & Time -->
      <div style="padding:0 32px 20px 32px;background-color:#fdf7f0;">
        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:20px;">
          <div style="font-size:13px;color:#3b3b3b;line-height:1.8;">
            <p style="margin:0 0 10px 0;font-size:15px;">
              📅 <span style="font-weight:600;color:#4b5563;">Date:</span>
              <span style="font-weight:700;color:#111827;background-color:#fff6ea;border-radius:8px;padding:2px 8px;display:inline-block;">${dateDisplay}</span>
            </p>
            <p style="margin:0;font-size:15px;">
              🕒 <span style="font-weight:600;color:#4b5563;">Time:</span>
              <span style="font-weight:700;color:#111827;background-color:#fff6ea;border-radius:8px;padding:2px 8px;display:inline-block;">${timeDisplay}</span>
            </p>
          </div>
        </div>
        <p style="margin:0 0 10px 0;font-size:14px;line-height:1.7;color:#4b5563;">
          During this visit, our team will align detailed technical references to ensure accuracy before moving further in the process.
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;line-height:1.7;color:#4b5563;">
          Kindly ensure site access at the scheduled time. Please inform us in advance if there are any access instructions.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;font-weight:500;">
          We&apos;re progressing smoothly to the next phase.
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
