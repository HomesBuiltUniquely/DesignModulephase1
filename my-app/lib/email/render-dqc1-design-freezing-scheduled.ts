export function renderDqc1DesignFreezingScheduledEmail(params: {
  customerName: string;
  meetingDate?: string;
  meetingTime?: string;
}) {
  const { customerName, meetingDate, meetingTime } = params;

  const formatDate = (value?: string) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
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
    return `${hour12}:${minutes} ${ampm} (EST)`;
  };

  const prettyDate = formatDate(meetingDate) || "Tuesday, October 24, 2023";
  const prettyTime = formatTime(meetingTime) || "10:30 AM — 11:30 AM (EST)";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DQC1 – Design Freezing Session Scheduled</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;
      box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- PART 1: Header, title, intro -->
      <div style="padding:40px 32px 32px 32px;">
        <!-- Brand -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td align="center">
              <div style="display:inline-block;">
                <div style="width:40px;height:40px;border-radius:9999px;background-color:#d62323;
                  display:flex;align-items:center;justify-content:center;margin:0 auto 10px auto;
                  box-shadow:0 4px 10px rgba(0,0,0,0.18);">
                  <span style="width:22px;height:22px;border-radius:9999px;border:1px solid #ffffff;
                    display:flex;align-items:center;justify-content:center;
                    color:#ffffff;font-size:11px;font-weight:600;">A</span>
                </div>
                <p style="margin:0;text-align:center;font-size:12px;letter-spacing:0.28em;
                  text-transform:uppercase;color:#111111;">
                  HUB INTERIOR DESIGN
                </p>
              </div>
            </td>
          </tr>
        </table>

        <div style="height:1px;background-color:#f1e2d4;margin-bottom:24px;"></div>

        <!-- Title -->
        <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111111;">
          DQC1 – Design Freezing Session Scheduled
        </h1>

        <!-- Intro -->
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4a4a4a;max-width:520px;">
          Hi ${customerName}, we are moving into the final stage of your interior transformation.
          It&apos;s time for our <span style="font-weight:600;color:#e53935;">Design Freezing Discussion</span>
          to finalize the layouts and project scope.
        </p>
      </div>

      <!-- PART 2: Meeting details, image, agenda -->
      <div style="padding:28px 32px 32px 32px;background-color:#fdf7f0;">
        <!-- Meeting details card -->
        <div style="background-color:#f8efdf;border-radius:18px;padding:16px 20px;
          box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:8px;">
                      <div style="width:20px;height:20px;border-radius:4px;border:1px solid #d64532;
                        display:flex;align-items:center;justify-content:center;">
                        <span style="width:12px;height:12px;border:2px solid #d64532;border-radius:3px;display:block;"></span>
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;
                        color:#2b2b2b;font-weight:600;">
                        Meeting Details
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="font-size:13px;color:#7b7b7b;">Date</td>
                    <td style="font-size:13px;font-weight:500;color:#1f1f1f;text-align:right;">
                      ${prettyDate}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#7b7b7b;padding-top:4px;">Time</td>
                    <td style="font-size:13px;font-weight:500;color:#1f1f1f;text-align:right;padding-top:4px;">
                      ${prettyTime}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- Hero image placeholder -->
        <div style="width:100%;height:190px;border-radius:18px;overflow:hidden;
          background:linear-gradient(90deg,#2f2b2a,#3b3634,#262220);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 10px 24px rgba(0,0,0,0.18);margin-bottom:24px;">
          <span style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a3a3a3;">
            Final living room render placeholder
          </span>
        </div>

        <!-- Agenda card -->
        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 20px;
          box-shadow:0 6px 18px rgba(0,0,0,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:8px;">
                      <div style="width:20px;height:20px;border-radius:4px;border:1px solid #d64532;
                        display:flex;align-items:center;justify-content:center;">
                        <span style="width:12px;height:12px;border-top:2px solid #d64532;border-left:2px solid #d64532;
                          transform:rotate(-45deg);display:block;"></span>
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;
                        color:#2b2b2b;font-weight:600;">
                        Meeting Agenda
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#3b3b3b;">
                  <li style="margin-bottom:6px;">
                    Final review and walkthrough of all <span style="font-weight:600;">revised layouts</span>.
                  </li>
                  <li style="margin-bottom:6px;">
                    Selection and approval of <span style="font-weight:600;">final design elements &amp; materials</span>.
                  </li>
                  <li>
                    Official sign-off on the <span style="font-weight:600;">project scope</span> to begin procurement.
                  </li>
                </ul>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- PART 3: CTA + signature + footer -->
      <div style="padding:32px 32px 34px 32px;background-color:#ffffff;">
        <!-- CTA -->
        <div style="text-align:center;margin-bottom:12px;">
          <a href="#"
            style="display:inline-block;padding:12px 32px;background-color:#d62323;color:#ffffff;
              font-size:14px;font-weight:600;border-radius:6px;text-decoration:none;
              box-shadow:0 10px 20px rgba(214,35,35,0.35);">
            Confirm This Time
          </a>
        </div>
        <p style="margin:0 0 24px 0;font-size:11px;color:#9ca3af;text-align:center;">
          If this time doesn&apos;t work for you, please reply to this email to reschedule.
        </p>

        <!-- Signature + contact -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;font-size:12px;color:#4b5563;">
          <tr>
            <td style="vertical-align:top;">
              <p style="margin:0 0 4px 0;">Warm regards,</p>
              <p style="margin:0 0 2px 0;font-weight:600;color:#111827;">Julian Vance</p>
              <p style="margin:0;font-size:11px;color:#d62323;">Lead Interior Architect</p>
            </td>
            <td style="vertical-align:top;text-align:right;">
              <p style="margin:0 0 4px 0;">
                <span style="font-size:13px;color:#9ca3af;margin-right:4px;">☎</span>
                <span style="font-size:12px;color:#4b5563;">+1 (555) 012-3456</span>
              </p>
              <p style="margin:0;">
                <span style="font-size:13px;color:#9ca3af;margin-right:4px;">✉</span>
                <span style="font-size:12px;color:#4b5563;">julian@hubinteriors.design</span>
              </p>
            </td>
          </tr>
        </table>

        <div style="height:1px;background-color:#f1e2d4;margin-bottom:12px;"></div>

        <p style="margin:0;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;
          color:#b3b3b3;text-align:center;">
          HUB INTERIOR DESIGN STUDIO · NEW YORK · LONDON · DUBAI
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

