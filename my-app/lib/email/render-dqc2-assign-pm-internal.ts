export function renderDqc2AssignPmInternalEmail(params: {
  customerName: string;
  projectName?: string;
  projectId?: string;
  designerName?: string;
  branchLocation?: string;
}) {
  const {
    customerName,
    projectName,
    projectId,
    designerName = "Design Team",
    branchLocation,
  } = params;

  const subject = `Action Required – Assign Project Manager for ${customerName}`;

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
          <!-- Header -->
          <tr>
            <td style="padding:20px 28px 16px 28px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#fef3c7,#fde68a);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:9999px;background-color:#d97706;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 12px rgba(217,119,6,0.4);">
                  <span style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">HI</span>
                </div>
                <div>
                  <div style="font-size:14px;letter-spacing:0.24em;text-transform:uppercase;color:#111827;font-weight:600;">HUB INTERIOR</div>
                  <div style="margin-top:4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#92400e;">Assign Project Manager</div>
                </div>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:22px 28px 10px 28px;">
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;">
                Dear <span style="font-weight:600;">Team</span>,
              </p>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                DQC 2 has been approved for <strong>${customerName}</strong>. The project is now ready to move to the next phase.
              </p>
              <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#b91c1c;font-weight:600;">
                ⚠️ Please assign a Project Manager for this project immediately.
              </p>
            </td>
          </tr>
          <!-- Project Details -->
          <tr>
            <td style="padding:0 28px 18px 28px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#92400e;font-weight:600;">Project Details</p>
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                      ${projectId ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Project ID</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${projectId}</td>
                      </tr>` : ""}
                      ${projectName ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Project Name</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${projectName}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Client Name</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${customerName}</td>
                      </tr>

                      ${branchLocation ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Branch</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${branchLocation}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:140px;">Designer</td>
                        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#111827;">${designerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#4b5563;">Regards,</p>
              <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#111827;">Team HUB Interiors</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px 16px 20px;background-color:#f9fafb;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">Internal – DQC 2 approved. Project Manager assignment required.</p>
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
