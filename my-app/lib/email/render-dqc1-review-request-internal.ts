type Dqc1ReviewRequestParams = {
  dqcRepName: string;
  customerName: string;
  ecName: string;
  designerName: string;
  projectValue: string;
};

export function renderDqc1ReviewRequestInternalEmail(params: Dqc1ReviewRequestParams) {
  const { dqcRepName, customerName, ecName, designerName, projectValue } = params;

  const subjectLine = `DQC 1 Review Request – ${customerName} – ${ecName}`;

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
          <!-- Header -->
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#fee2e2,#fef3c7);">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:36px;height:36px;border-radius:9999px;background-color:#dc2626;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(220,38,38,0.45);">
                        <span style="width:20px;height:20px;border-radius:9999px;border:1px solid #fee2e2;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:600;">A</span>
                      </div>
                      <div>
                        <div style="font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:#111827;font-weight:600;">
                          HUB INTERIOR DESIGN
                        </div>
                        <div style="margin-top:4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#ef4444;">
                          DQC 1 Review Request
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body: intro + project summary -->
          <tr>
            <td style="padding:22px 28px 10px 28px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;">
                Dear <span style="font-weight:600;">${dqcRepName}</span>,
              </p>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                The final design files for the below project have been uploaded and are ready for <strong>DQC 1 review</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 4px 0;background-color:#f9fafb;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px 8px 18px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;font-weight:600;">
                      Project Snapshot
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 18px 14px 18px;">
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
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;">Project Value</td>
                        <td style="padding:4px 0;font-weight:600;color:#16a34a;">₹ ${projectValue}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Files & instructions -->
          <tr>
            <td style="padding:6px 28px 20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#fef2f2;border-radius:18px;padding:16px 18px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#b91c1c;font-weight:600;">
                      Files Submitted
                    </p>
                    <ul style="margin:0 0 10px 18px;padding:0;font-size:13px;line-height:1.6;color:#4b5563;">
                      <li>Final Prolance File</li>
                      <li>Updated Estimate</li>
                    </ul>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#4b5563;">
                      Kindly review and share your approval/comments at the earliest convenience.
                      A calendar block has been scheduled as per your availability.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">
                Regards,
              </p>
              <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#111827;">
                ${designerName}
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Design Team · HUB Interior
              </p>
            </td>
          </tr>

          <!-- Footer hint -->
          <tr>
            <td style="padding:12px 20px 16px 20px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                This is an internal notification for the DQC team. Please respond with approval or comments in the DQC workflow.
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

