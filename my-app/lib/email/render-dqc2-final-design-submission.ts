export function renderDqc2FinalDesignSubmissionEmail(params: { customerName: string }) {
  const { customerName } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DQC2 – Final Design Submission</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f3e5d8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <tr>
            <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #f3f4f6;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:32px;height:32px;background-color:#d62323;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;transform:rotate(45deg);">
                        <span style="color:#ffffff;font-weight:700;font-size:12px;transform:rotate(-45deg);display:inline-block;">HI</span>
                      </div>
                      <span style="font-size:18px;font-weight:600;color:#111827;">HUB Interior</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.4;font-weight:600;color:#111827;">
                DQC2 – Final Design Submission
              </h1>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Hi ${customerName},
              </p>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                Your final design set for DQC2 has been prepared and is now ready for your review.
              </p>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                This pack includes your confirmed layouts, material selections, and key details that will guide the next stages of your project.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:18px;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">
                      What you can expect now
                    </p>
                    <ul style="margin:0 0 8px 18px;padding:0;font-size:13px;line-height:1.6;color:#4b5563;">
                      <li>Review the final design pack shared by your designer.</li>
                      <li>Share any last clarifications or micro‑tweaks, if needed.</li>
                      <li>Move towards design sign‑off and budget confirmation.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px 32px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left">
                    <p style="margin:0 0 4px 0;font-size:14px;line-height:1.6;color:#4b5563;">
                      Warm regards,
                    </p>
                    <p style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#111827;">
                      Team HUB Interior
                    </p>
                  </td>
                  <td align="right">
                    <a href="#" style="display:inline-block;padding:10px 22px;background-color:#d62323;color:#ffffff;font-size:13px;font-weight:600;border-radius:9999px;text-decoration:none;">
                      View Final Designs
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;padding:16px 24px 18px 24px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">
                You are receiving this email as part of your project journey with HUB Interior.
              </p>
              <p style="margin:0;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#d1d5db;">
                © 2024 HUB INTERIOR. ALL RIGHTS RESERVED.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

