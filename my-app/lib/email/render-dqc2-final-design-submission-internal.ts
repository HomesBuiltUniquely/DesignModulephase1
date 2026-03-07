type Dqc2FinalDesignSubmissionInternalParams = {
  dqcRepName: string;
  customerName: string;
  ecName: string;
  designerName: string;
  projectValue?: string;
};

export function renderDqc2FinalDesignSubmissionInternalEmail(
  params: Dqc2FinalDesignSubmissionInternalParams,
) {
  const { dqcRepName, customerName, ecName, designerName, projectValue } = params;

  const subjectLine = `DQC 2 Review Request – ${customerName} – ${ecName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subjectLine}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(15,23,42,0.12);">
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#dbeafe,#e0e7ff);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:9999px;background-color:#2563eb;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(37,99,235,0.4);">
                  <span style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">HI</span>
                </div>
                <div>
                  <div style="font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:#111827;font-weight:600;">
                    HUB INTERIOR
                  </div>
                  <div style="margin-top:4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#2563eb;">
                    DQC 2 Review Request
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 10px 28px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;">
                Dear <span style="font-weight:600;">${dqcRepName}</span>,
              </p>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                The project is now ready for DQC 2 review following completion of color selection and final design updates.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px 0;background-color:#f9fafb;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px 8px 18px;">
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
                      ${projectValue ? `
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;">Final Project Value</td>
                        <td style="padding:4px 0;font-weight:600;color:#16a34a;">₹ ${projectValue}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 8px 0;font-size:14px;font-weight:600;color:#111827;">Files Submitted:</p>
              <ul style="margin:0 0 14px 18px;padding:0;font-size:14px;line-height:1.7;color:#4b5563;">
                <li>Updated Prolance File</li>
                <li>Final Estimate</li>
                <li>Laminate &amp; Hardware Selection Sheet</li>
                <li>Revised Design Views</li>
              </ul>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Kindly review and share your approval/comments.
              </p>
              <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                A calendar block has been scheduled as per your availability.
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
              <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#111827;">
                Team HUB
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 16px 20px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                Internal notification – DQC 2 review request.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: subjectLine, html };
}
