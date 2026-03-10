export function renderDqc1FirstCutDesignScheduledEmail(params: {
  customerName: string;
  meetingDate?: string;
  meetingTime?: string;
  designerName?: string;
  designerTitle?: string;
  /**
   * Public URL to the designer's profile image.
   * If omitted, a neutral placeholder avatar is rendered instead.
   */
  designerAvatarUrl?: string;
}) {
  const {
    customerName,
    meetingDate,
    meetingTime,
    designerName,
    designerTitle,
    designerAvatarUrl,
  } = params;

  const formatDate = (value?: string) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (value?: string) => {
    if (!value) return null;
    const [hStr, mStr = "0"] = value.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) return value;
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = ((h + 11) % 12) + 1;
    const minutes = String(m).padStart(2, "0");
    return `${hour12}:${minutes} ${ampm}`;
  };

  const prettyDate = formatDate(meetingDate) || "October 24, 2023";
  const prettyTime = formatTime(meetingTime) || "2:00 PM — 3:00 PM (EST)";
  const assetBase =
    process.env.FRONTEND_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://design.hubinterior.com";
  const heroImageUrl = `${assetBase}/scandanavian.png`;

  const signatureName = designerName || "Sarah Mitchell";
  const signatureTitle = designerTitle || "Lead Designer, HUB Interior";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DQC1 – First Cut Design Presentation Scheduled</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f5ee;">
  <div style="min-height:100vh;background-color:#f8f5ee;padding:48px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:24px;
      box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- PART 1: Header, title, greeting, image, meeting details -->
      <div style="padding:48px 32px 40px 32px;">
        <!-- Logo & brand -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:35px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <div style="width:36px;height:36px;background-color:#da4b3a;border-radius:10px;display:block;text-align:center;line-height:36px;">
                      <span style="display:inline-block;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;line-height:36px;">HI</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="text-align:center;">
                      <p style="margin:0;font-size:16px;font-weight:400;letter-spacing:0.08em;
                        text-transform:uppercase;color:#333333;font-family:Arial,Helvetica,sans-serif;">
                        HUB Interior
                      </p>
                      <div style="margin:8px auto 0 auto;width:70px;height:1px;background-color:#d4d4d4;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Main title -->
        <h1 style="margin:0 0 20px 0;font-size:30px;line-height:1.15;
          font-weight:800;color:#000000;text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">
          First Cut Design Discussion Scheduled
        </h1>

        <!-- Intro text -->
        <p style="margin:0 0 28px 0;font-size:17px;line-height:1.5;font-weight:400;
          color:#4a4a4a;text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">
          Hi ${customerName}, we are excited to share the initial design concepts for your space.
          Let’s review the vision together.
        </p>

        <!-- Image block -->
        <div style="width:100%;height:220px;background-color:#e8e0d0;border-radius:12px;
          overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:36px;">
          <img src="${heroImageUrl}" alt="First cut design discussion visual"
            style="display:block;width:100%;height:100%;object-fit:cover;border:0;" />
        </div>

        <!-- Meeting details -->
        <div style="background-color:#f5f2eb;border-radius:20px;padding:20px 24px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;">
                <span style="font-size:13px;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;color:#6b7280;">
                  Date
                </span>
              </td>
              <td style="padding:12px 0;border-bottom:1px solid #e0e0e0;text-align:right;">
                <span style="font-size:17px;font-weight:600;color:#1f2937;">
                  ${prettyDate}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;">
                <span style="font-size:13px;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;color:#6b7280;">
                  Time
                </span>
              </td>
              <td style="padding:12px 0;text-align:right;">
                <span style="font-size:17px;font-weight:600;color:#1f2937;">
                  ${prettyTime}
                </span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- PART 2: Note, CTA, signature, contact, disclaimer -->
      <div style="padding:0 32px 0 32px;">
        <!-- Note -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="width:26px;vertical-align:top;padding-top:4px;">
              <span style="display:inline-block;width:18px;height:18px;border-radius:9999px;background-color:#da4b3a;
                text-align:center;line-height:18px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background-color:#ffffff;"></span>
              </span>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;font-size:15px;font-weight:400;color:#333333;line-height:1.6;">
                The virtual meeting link will be sent automatically to your calendar once you confirm the time below.
              </p>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:40px;">
          <a href="#"
            style="display:inline-block;padding:14px 32px;background-color:#da4b3a;color:#ffffff;
              font-size:17px;font-weight:700;border-radius:10px;text-decoration:none;margin-bottom:12px;">
            Confirm This Time
          </a>
          <div>
            <a href="#"
              style="font-size:15px;color:#da4b3a;font-weight:400;text-decoration:underline;">
              Request a different time
            </a>
          </div>
        </div>

        <div style="height:1px;background-color:#e5e5e5;margin-bottom:32px;"></div>

        <!-- Signature -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:32px;">
          <tr>
            <td style="width:52px;vertical-align:top;">
              ${
                designerAvatarUrl
                  ? `<img src="${designerAvatarUrl}" alt="${signatureName}" style="width:44px;height:44px;border-radius:9999px;object-fit:cover;display:block;" />`
                  : `<div style="width:44px;height:44px;border-radius:9999px;background-color:#d1d5db;"></div>`
              }
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <p style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#1f1f1f;line-height:1.2;">
                Best, ${signatureName}
              </p>
              <p style="margin:0;font-size:13px;font-weight:400;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">
                ${signatureTitle}
              </p>
            </td>
          </tr>
        </table>

        <!-- Contact info -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:13px;color:#9ca3af;">
          <tr>
            <td style="padding:0 16px 8px 0;vertical-align:middle;">
              <span style="margin-right:4px;">📞</span>+91 8898891117
            </td>
            <td style="padding:0 16px 8px 0;vertical-align:middle;">
              <span style="margin-right:4px;">✉</span>communication@hubinterior.com
            </td>
            <td style="padding:0 0 8px 0;vertical-align:middle;">
              <span style="margin-right:4px;">📍</span>Bangalore, Karnataka
            </td>
          </tr>
        </table>

        <!-- Disclaimer -->
        <p style="margin:0 0 24px 0;font-size:11px;font-weight:400;color:#9ca3af;line-height:1.6;">
          You’re receiving this because you’ve engaged with HUB Interior for your project.
          To manage your communication preferences, please visit your client portal.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color:#f0ebe3;border-radius:0 0 24px 24px;padding:16px 32px;">
        <p style="margin:0;font-size:11px;font-weight:400;color:#9ca3af;text-align:center;">
          © 2023 HUB Interior Design Studio. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}
