export function renderD1SiteMeasurementEmail(params: { customerName: string }) {
  const { customerName } = params;

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
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;">
          <div style="width:40px;height:40px;background-color:#d62323;display:flex;align-items:center;justify-content:center;border-radius:8px;transform:rotate(45deg);">
            <span style="color:#ffffff;font-weight:700;font-size:14px;transform:rotate(-45deg);display:inline-block;">HI</span>
          </div>
          <span style="font-size:18px;font-weight:600;color:#000000;letter-spacing:-0.01em;">
            HUB Interior
          </span>
        </div>
        <div style="height:1px;background-color:#f1e4d2;margin-bottom:32px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:4px 20px;border-radius:9999px;background-color:#f6ebdd;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#4c3a26;margin-bottom:24px;">
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
          <div style="position:absolute;top:20px;right:24px;width:20px;height:20px;background-color:#d62323;border-radius:4px;"></div>
          <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:#d62323;margin:0 0 4px 0;">
            Step 01
          </p>
          <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Current Stage
          </p>
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="width:56px;height:56px;border-radius:9999px;background-color:#ffffff;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:17px;font-weight:600;color:#111827;">D1</span>
            </div>
            <div>
              <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                Site Measurement
              </p>
              <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                Initial verification of your floor plan and dimensions.
              </p>
            </div>
          </div>
        </div>

        <div style="background-color:#f7e4cd;border-radius:18px;padding:24px;margin-bottom:24px;">
          <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Here’s what happens next
          </p>
          <div style="font-size:14px;line-height:22px;color:#4b5563;">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
              <span style="margin-top:5px;width:12px;height:12px;border-radius:9999px;border:5px solid #d62323;background-color:#d62323;display:inline-block;"></span>
              <div>
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  Confirm Measurement Slot
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Select a time for our designer to visit your site.
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
              <span style="margin-top:6px;width:12px;height:12px;border-radius:9999px;border:1px solid #d1d5db;display:inline-block;"></span>
              <div>
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  Moodboard Presentation
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Review initial design directions and material palettes.
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <span style="margin-top:6px;width:12px;height:12px;border-radius:9999px;border:1px solid #d1d5db;display:inline-block;"></span>
              <div>
                <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 4px 0;">
                  3D Visualization
                </p>
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  Experience your home through high-quality renders.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style="background-color:#f7e4cd;border-radius:18px;padding:24px;margin-bottom:32px;">
          <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 16px 0;">
            Offer Confirmed
          </p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
            <div style="background-color:#ffffff;border-radius:14px;padding:12px 16px;">
              <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#9ca3af;margin:0 0 4px 0;">
                Project ID
              </p>
              <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">
                #HUB-2024-892
              </p>
            </div>
            <div style="background-color:#ffffff;border-radius:14px;padding:12px 16px;">
              <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:#9ca3af;margin:0 0 4px 0;">
                Property Type
              </p>
              <p style="font-size:14px;font-weight:600;color:#111827;margin:0;">
                4-Room Apartment
              </p>
            </div>
          </div>
        </div>

        <div style="text-align:center;">
          <a href="#" style="display:inline-block;width:100%;padding:16px 24px;background-color:#d62323;color:#ffffff;font-size:15px;font-weight:600;border-radius:9999px;text-decoration:none;">
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
        <div style="font-size:13px;color:#6b7280;margin:0 0 24px 0;">
          <p style="margin:0 0 4px 0;">123 Design District, Suite 405, Creative City</p>
          <p style="margin:0;">hello@hubinterior.design</p>
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
