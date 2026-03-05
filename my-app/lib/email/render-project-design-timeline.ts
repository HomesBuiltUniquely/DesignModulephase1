export function renderProjectDesignTimelineEmail(params: { customerName: string }) {
  const { customerName } = params;

  const steps = [
    { id: 1, title: 'Initial Consultation', description: 'Within 2 days' },
    { id: 2, title: 'Site Measurement', description: 'Scheduled within 1 week' },
    { id: 3, title: 'Concept Development', description: '3–5 Business days' },
    { id: 4, title: 'Design Presentation', description: 'Scheduled session' },
    { id: 5, title: 'Material Selection', description: '2–4 Business days' },
    { id: 6, title: 'Revised Drafts', description: 'Within 3 days' },
    { id: 7, title: 'Final Design Approval', description: 'Major milestone' },
    { id: 8, title: 'Budget Estimation', description: '2 Business days' },
    { id: 9, title: 'Contract Signing', description: 'Upon review' },
    { id: 10, title: 'Procurement', description: 'Ongoing process' },
    { id: 11, title: 'Site Preparation', description: 'Site ready for installation' },
    { id: 12, title: 'Installation & Styling', description: 'On-site execution' },
    { id: 13, title: 'Final Handover', description: 'Project completion' },
  ];

  const stepsHtml = steps
    .map(
      (step) => `
        <tr>
          <td align="center" valign="top" width="40" style="padding-top:6px;">
            <div style="width:28px;height:28px;border-radius:9999px;background-color:#d62323;color:#ffffff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;margin:0 auto;">
              ${step.id}
            </div>
          </td>
          <td align="left" valign="top" style="padding-left:8px;padding-bottom:12px;">
            <p style="margin:0 0 2px 0;font-size:15px;font-weight:600;color:#111827;">
              ${step.title}
            </p>
            <p style="margin:0;font-size:13px;color:#6b7280;">
              ${step.description}
            </p>
          </td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Design Timeline</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3e5d8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;background-color:#fdf9f3;border-radius:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="padding:40px 32px 24px 32px;background-color:#fdf9f3;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" valign="middle" style="padding-right:8px;">
                          <div style="width:36px;height:36px;background-color:#d62323;border-radius:8px;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);">
                            <span style="color:#ffffff;font-weight:700;font-size:12px;transform:rotate(-45deg);display:inline-block;">HI</span>
                          </div>
                        </td>
                        <td align="left" valign="middle">
                          <span style="display:block;font-size:18px;font-weight:600;color:#111827;line-height:1.2;">
                            HUB Interior
                          </span>
                        </td>
                      </tr>
                    </table>
                    <div style="height:1px;background-color:#f0e0ce;width:100%;margin-top:16px;"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;">
                    <h1 style="margin:0 0 6px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
                      Project Design Timeline
                    </h1>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;max-width:360px;">
                      Hi ${customerName}, your journey to a beautiful space starts here. Here&apos;s an overview of the key stages ahead.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px 32px;background-color:#fdf9f3;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;padding:24px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                <tr>
                  <td style="position:relative;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                      ${stepsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px 32px;background-color:#fdf9f3;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#ffe7e7;border-radius:18px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#111827;">
                      We&apos;re excited to bring your vision to life.
                    </p>
                    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#4b5563;">
                      Our team is dedicated to crafting a space that reflects your unique style and needs.
                    </p>
                    <p style="margin:0 0 2px 0;font-size:13px;color:#4b5563;">
                      Warmly,
                    </p>
                    <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;color:#d62323;">
                      Team HUB
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="right">
                          <a href="#" style="display:inline-block;padding:10px 24px;background-color:#e0392f;color:#ffffff;font-size:13px;font-weight:600;border-radius:9999px;text-decoration:none;">
                            Project Dashboard
                            <span style="margin-left:6px;font-size:16px;" aria-hidden="true">→</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#efddc8;padding:24px 24px 22px 24px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8b7660;">
                © 2024 HUB INTERIOR DESIGN STUDIO
              </p>
              <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b7660;">
                123 DESIGN AVENUE, SUITE 500
              </p>
              <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b7660;">
                HUBINTERIOR.COM | CONTACT@HUBINTERIOR.COM
              </p>
              <p style="margin:0 0 2px 0;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#b1997f;">
                This email was sent to you regarding your project with HUB Interior.
              </p>
              <p style="margin:0;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#b1997f;">
                Manage email preferences
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

