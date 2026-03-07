export function renderD2MaskingRequestInternalEmail(params: {
  customerName: string;
  designerName: string;
  ecName: string;
  mmtName?: string | null;
  pmName?: string | null;
  maskingDate?: string | null;
  maskingTime?: string | null;
}) {
  const {
    customerName,
    designerName,
    ecName,
    mmtName,
    pmName,
  } = params;

  const greeting = mmtName && pmName
    ? `Dear ${mmtName} & ${pmName},`
    : mmtName
      ? `Dear ${mmtName} & PM Team,`
      : pmName
        ? `Dear MMT Team & ${pmName},`
        : "Dear MMT & PM Team,";

  const subject = `D2 Site Masking Request – ${customerName} – ${ecName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#fef3c7,#dbeafe);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:9999px;background-color:#d97706;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(217,119,6,0.4);">
                  <span style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">HI</span>
                </div>
                <div>
                  <div style="font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:#111827;font-weight:600;">
                    HUB INTERIOR
                  </div>
                  <div style="margin-top:4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#b45309;">
                    D2 Site Masking Request (Internal)
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 8px 28px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;">
                ${greeting}
              </p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                DQC 1 has been approved and 10% payment is confirmed for the below project.
              </p>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Kindly proceed with scheduling the D2 – Site Masking activity.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px 0;background-color:#f9fafb;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 18px 10px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;color:#374151;">
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;width:40%;">Project Name</td>
                        <td style="padding:4px 0;font-weight:600;color:#111827;">${customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;">Experience Center</td>
                        <td style="padding:4px 0;font-weight:500;color:#111827;">${ecName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;">Designer</td>
                        <td style="padding:4px 0;font-weight:500;color:#111827;">${designerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 6px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                All updated design files are available in ERP for reference.
              </p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Please coordinate and confirm the scheduled date.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">
                Regards,
              </p>
              <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#111827;">
                ${designerName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 16px 20px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                CC: Designer + Manager + TDM + PM + SPM + OH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
