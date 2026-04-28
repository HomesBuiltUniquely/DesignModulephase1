export function renderD1SiteMeasurementEmail(params: {
  customerName: string;
  projectId?: number | string;
  propertyType?: string;
}) {
  const { customerName, projectId, propertyType } = params;

  const displayProjectId = projectId ? String(projectId) : '#HUB-2024-892';
  const displayPropertyType = propertyType || '4-Room Apartment';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D1 Site Measurement</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3e5d8; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
  <div style="min-height:100vh;background-color:#f3e5d8;padding:48px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:24px;box-shadow:0 1px 2px rgba(0,0,0,0.05);overflow:hidden;">
      <div style="padding:40px 40px 24px 40px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;">
          <tr>
            <td style="vertical-align:middle;padding-right:8px;">
              <div style="width:40px;height:40px;background-color:#d62323;border-radius:8px;transform:rotate(45deg);text-align:center;line-height:40px;">
                <span style="color:#ffffff;font-weight:700;font-size:14px;transform:rotate(-45deg);display:inline-block;line-height:40px;">HI</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:18px;font-weight:600;color:#000000;letter-spacing:-0.01em;">
                HUB Interior
              </span>
            </td>
          </tr>
        </table>
        <div style="height:1px;background-color:#f1e4d2;margin-bottom:32px;"></div>
        <div style="display:inline-block;padding:4px 20px;border-radius:9999px;background-color:#f6ebdd;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#4c3a26;margin-bottom:24px;">
          Welcome onboard
        </div>
        <h1 style="font-size:28px;line-height:36px;font-weight:600;color:#111827;margin:0 0 12px 0;">
          Let’s begin your design journey
        </h1>
        <p style="font-size:15px;line-height:24px;color:#4b5563;margin:0 0 40px 0;">
          Hi ${customerName}, we’re thrilled to start this creative process with you. Your dream space is just a few steps away from reality.
        </p>
      </div>

      <div style="padding:0 40px 40px 40px;">
        <div style="position:relative;background-color:#f7e4cd;border-radius:18px;padding:24px;margin-bottom:32px;">
          <div style="position:absolute;top:22px;right:22px;width:14px;height:14px;background-color:#d62323;border-radius:3px;"></div>
          <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:#d62323;margin:0 0 4px 0;">
            Step 01
          </p>
          <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Current Stage
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:72px;vertical-align:top;">
                <div style="width:56px;height:56px;border-radius:9999px;background-color:#ffffff;text-align:center;line-height:56px;">
                  <span style="font-size:17px;font-weight:600;color:#111827;line-height:56px;">D1</span>
                </div>
              </td>
              <td style="vertical-align:top;">
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  Site Measurement
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Initial verification of your floor plan and dimensions.
                </p>
              </td>
            </tr>
          </table>
        </div>

        <div style="background-color:#f7e4cd;border-radius:18px;padding:24px;margin-bottom:24px;">
          <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Here’s what happens next
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:14px;line-height:22px;color:#4b5563;">
            <tr>
              <td style="width:24px;vertical-align:top;padding-top:4px;">
                <span style="width:10px;height:10px;border-radius:9999px;border:4px solid #d62323;background-color:#d62323;display:inline-block;"></span>
              </td>
              <td style="vertical-align:top;padding-bottom:16px;">
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  Confirm Measurement Slot
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Select a time for our designer to visit your site.
                </p>
              </td>
            </tr>
            <tr>
              <td style="width:24px;vertical-align:top;padding-top:4px;">
                <span style="width:10px;height:10px;border-radius:9999px;border:1px solid #d1d5db;display:inline-block;"></span>
              </td>
              <td style="vertical-align:top;padding-bottom:16px;">
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  Moodboard Presentation
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Review initial design directions and material palettes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="width:24px;vertical-align:top;padding-top:4px;">
                <span style="width:10px;height:10px;border-radius:9999px;border:1px solid #d1d5db;display:inline-block;"></span>
              </td>
              <td style="vertical-align:top;">
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  3D Visualization
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Experience your home through high-quality renders.
                </p>
              </td>
            </tr>
          </table>
        </div>

        <div style="background-color:#f7e4cd;border-radius:18px;padding:24px;margin-bottom:32px;">
          <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Offer Confirmed
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:8px;">
                <div style="background-color:#ffffff;border-radius:14px;padding:12px 16px;">
                  <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#9ca3af;margin:0 0 4px 0;">
                    Project ID
                  </p>
                  <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">
                    ${displayProjectId}
                  </p>
                </div>
              </td>
              <td style="width:50%;vertical-align:top;padding-left:8px;">
                <div style="background-color:#ffffff;border-radius:14px;padding:12px 16px;">
                  <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#9ca3af;margin:0 0 4px 0;">
                    Property Type
                  </p>
                  <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">
                    ${displayPropertyType}
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;">
          <a href="#" style="display:block;box-sizing:border-box;width:100%;max-width:560px;margin:0 auto;padding:16px 24px;background-color:#d62323;color:#ffffff;font-size:15px;font-weight:600;border-radius:9999px;text-decoration:none;text-align:center;">
            Confirm Measurement Slot
          </a>
          <p style="font-size:13px;color:#6b7280;margin:16px 0 0 0;">
            Have questions?
            <a href="#" style="color:#d62323;font-weight:600;text-decoration:none;margin-left:4px;">
              Contact your designer
            </a>
            .
          </p>
        </div>
      </div>

      <div style="padding:32px 40px;background-color:#ffffff;border-top:1px solid #f3f4f6;">
        <p style="font-size:15px;font-style:italic;color:#374151;margin:0 0 16px 0;">
          “Designing with intent, living with beauty.”
        </p>
        <p style="font-size:14px;color:#374151;margin:0 0 4px 0;">Warm regards,</p>
        <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 24px 0;">
          Team HUB Interior
        </p>
        <div style="font-size:13px;color:#6b7280;line-height:20px;margin:0 0 24px 0;">
          <p style="margin:0 0 4px 0;"><strong>Contact email:</strong> communication@hubinterior.com</p>
          <p style="margin:0 0 4px 0;"><strong>Phone no:</strong> +91 8898891117</p>
          <p style="margin:0;"><strong>Address:</strong> HBR Layout, Bangalore, 1st Floor, 6th Cross Rd, 1st Stage, HBR Layout 4th Block, HBR Layout, Bengaluru, Karnataka 560044</p>
        </div>
      </div>

      <div style="padding:24px 40px;background-color:#f8f5ef;text-align:center;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#9c8b73;margin:0 0 4px 0;">
          You received this email because you started a project with HUB Interior.
        </p>
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#9c8b73;margin:0;">
          © 2024 HUB INTERIOR. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
