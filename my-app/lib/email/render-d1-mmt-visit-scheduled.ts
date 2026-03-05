export function renderD1MmtVisitScheduledEmail(params: {
  customerName: string;
  visitDate?: string;
  visitTime?: string;
  executiveName?: string;
  executivePhone?: string;
}) {
  const {
    customerName,
    visitDate,
    visitTime,
    executiveName,
    executivePhone,
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

  const prettyDate = formatDate(visitDate) || "October 24, 2023";
  const prettyTime = formatTime(visitTime) || "10:00 AM";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D1 – MMT Visit Scheduled</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f4ef;">
  <div style="min-height:100vh;background-color:#f7f4ef;padding:48px 16px;
    background-image:radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px);
    background-size:24px 24px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:18px;
      box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- Header + Brand -->
      <div style="padding:40px 40px 32px 40px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;">
            <div style="width:44px;height:44px;background-color:#da4b3a;border-radius:10px;
              display:block;margin:0 auto 12px auto;">
              <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <!-- Compass / divider style icon -->
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden
                  style="fill:none;stroke:#ffffff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;">
                  <circle cx="12" cy="6" r="1.6" fill="#ffffff" />
                  <path d="M12 7.8 8.2 18.5" />
                  <path d="M12 7.8 15.8 18.5" />
                  <path d="M9.2 14.5h5.6" />
                </svg>
              </div>
            </div>
            <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#333333;">
              HUB Interior
            </p>
          </div>
        </div>

        <!-- Confirmation pill -->
        <div style="text-align:center;margin-bottom:24px;">
          <span style="display:inline-block;padding:6px 22px;background-color:#fbe3df;border-radius:9999px;
            font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#da4b3a;">
            CONFIRMATION
          </span>
        </div>

        <!-- Title + intro -->
        <h1 style="margin:0 0 12px 0;font-size:26px;line-height:34px;font-weight:700;color:#333333;text-align:center;">
          Site Measurement Visit Scheduled
        </h1>
        <p style="margin:0 auto 28px auto;max-width:520px;font-size:14px;line-height:22px;color:#555555;text-align:center;">
          Hi ${customerName}, your upcoming site audit for the interior project has been confirmed.
          Please find the visit details below.
        </p>

        <!-- Visit details card -->
        <div style="background-color:#f8f8f8;border-radius:18px;padding:24px 20px 20px 20px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden
              style="color:#da4b3a;stroke:currentColor;stroke-width:2;">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#333333;">
              Visit Details
            </p>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#555555;">
            <tr>
              <td style="padding:4px 0;vertical-align:top;width:55%;color:#555555;">
                Date
              </td>
              <td style="padding:4px 0;vertical-align:top;text-align:right;font-weight:600;color:#333333;">
                ${prettyDate}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;vertical-align:top;color:#555555;">
                Time
              </td>
              <td style="padding:4px 0;vertical-align:top;text-align:right;font-weight:600;color:#333333;">
                ${prettyTime}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;vertical-align:top;color:#555555;">
                Measurement Executive
              </td>
              <td style="padding:4px 0;vertical-align:top;text-align:right;color:#333333;">
                <div style="font-weight:600;color:#333333;">
                  ${executiveName || "[Executive Name]"}
                </div>
                <div style="font-size:13px;color:#777777;margin-top:2px;">
                  ${executivePhone || "[Executive Phone]"}
                </div>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Middle content -->
      <div style="padding:0 40px 40px 40px;">
        <!-- Please note -->
        <div style="background-color:#ffffff;border-radius:18px;padding:20px;border:1px solid #e5e7eb;
          box-shadow:0 1px 3px rgba(0,0,0,0.03);margin-bottom:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="width:20px;vertical-align:middle;padding-right:8px;">
                <span style="display:inline-block;width:18px;height:18px;border-radius:9999px;background-color:#da4b3a;
                  text-align:center;line-height:18px;font-size:10px;font-weight:700;color:#ffffff;">i</span>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#333333;">
                  Please Note
                </p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;font-size:14px;color:#555555;">
            <tr>
              <td style="width:18px;vertical-align:top;padding-top:6px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background-color:#da4b3a;"></span>
              </td>
              <td style="vertical-align:top;padding:2px 0 8px 0;">
                Ensure site access and keys are ready at the scheduled time.
              </td>
            </tr>
            <tr>
              <td style="width:18px;vertical-align:top;padding-top:6px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background-color:#da4b3a;"></span>
              </td>
              <td style="vertical-align:top;padding:2px 0 8px 0;">
                Electricity availability is required for high‑precision laser measurements.
              </td>
            </tr>
            <tr>
              <td style="width:18px;vertical-align:top;padding-top:6px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background-color:#da4b3a;"></span>
              </td>
              <td style="vertical-align:top;padding:2px 0 0 0;">
                Arrange society gate permissions or visitor passes prior to the visit.
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="#"
            style="display:inline-block;width:100%;padding:14px 20px;background-color:#da4b3a;color:#ffffff;
              font-size:14px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
              border-radius:12px;text-decoration:none;">
            Share Access Instructions
          </a>
          <p style="margin:14px 0 0 0;font-size:13px;color:#6b7280;">
            Need to reschedule?
            <a href="#" style="color:#6b7280;text-decoration:underline;">Click here</a>
          </p>
        </div>

        <!-- Placeholder visual banner -->
        <div style="width:100%;height:200px;background-color:#f5f0e8;border-radius:18px;
          display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
          <span style="font-size:13px;color:#9ca3af;">
            [Wooden desk, blueprints, mug, office chair]
          </span>
        </div>

        <!-- Closing -->
        <div style="text-align:center;">
          <p style="margin:0 0 4px 0;font-size:14px;color:#374151;">Warmly,</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">Team HUB Interior</p>
        </div>
      </div>

      <!-- Footer -->
      <footer style="padding:24px 40px;background-color:#f7f4ef;text-align:center;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;">
          Contact us: support@hubinterior.com · +91 (80) 1234‑5678
        </p>
        <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">
          123 Design District, High‑Rise Blvd, Metro City
        </p>
        <div style="padding-top:8px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:10px;color:#9ca3af;">
            INTERNAL REF: SITE-AUDIT | CC: OPS‑TEAM
          </p>
        </div>
      </footer>
    </div>
  </div>
</body>
</html>`;

  return html;
}

