export interface LaminateSelections {
  kitchen?: {
    baseShutters?: string;
    wallShutters?: string;
    tallUnits?: string;
    internalFinish?: string;
    hingesChannels?: string;
    handles?: string;
  };
  masterBedroom?: {
    wardrobeShutters?: string;
    loftFinish?: string;
    internalFinish?: string;
    hingesChannels?: string;
    handles?: string;
  };
  bedroom2?: {
    wardrobeShutters?: string;
    loftFinish?: string;
    internalFinish?: string;
    hingesChannels?: string;
    handles?: string;
  };
  livingRoom?: {
    baseFinish?: string;
    highlightAccent?: string;
  };
}

export function renderMomColorLaminateSelectionConfirmationEmail(params: {
  customerName: string;
  designerName?: string;
  laminateSelections?: LaminateSelections | null;
}) {
  const {
    customerName,
    designerName = "Designer",
    laminateSelections = {},
  } = params;

  const k = laminateSelections?.kitchen ?? {};
  const mb = laminateSelections?.masterBedroom ?? {};
  const b2 = laminateSelections?.bedroom2 ?? {};
  const lr = laminateSelections?.livingRoom ?? {};

  const subject = "MOM – Color & Laminate Selection Confirmation";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3e5d8;">
  <div style="min-height:100vh;background-color:#f3e5d8;padding:40px 16px;">
    <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:26px;box-shadow:0 4px 18px rgba(0,0,0,0.08);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <!-- Header / Brand -->
      <div style="padding:40px 32px 28px 32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;gap:12px;margin-bottom:18px;">
          <div style="width:40px;height:40px;background-color:#d62323;border-radius:10px;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);">
            <span style="color:#ffffff;font-weight:700;font-size:14px;transform:rotate(-45deg);display:inline-block;">HI</span>
          </div>
          <div style="text-align:left;">
            <div style="font-size:18px;font-weight:600;color:#111827;line-height:1.2;">HUB Interior</div>
          </div>
        </div>
        <div style="height:1px;background-color:#f1e4d2;margin-bottom:18px;"></div>
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 18px;border-radius:9999px;background-color:#f6ebdd;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#4c3a26;margin-bottom:12px;">
          MOM – Color & Laminate Selection
        </div>
        <h1 style="margin:0 0 10px 0;font-size:26px;line-height:1.3;font-weight:600;color:#111827;">
          Color & Laminate Selection Confirmation
        </h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          Dear ${customerName},
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          Thank you for visiting the Experience Center for the color and material selection discussion.
        </p>
        <p style="margin:8px 0 0 0;font-size:14px;line-height:1.7;color:#4b5563;max-width:520px;margin-left:auto;margin-right:auto;">
          Please find below the summary of the finalised laminate selections for your project:
        </p>
      </div>

      <!-- Room-wise Laminate Selections -->
      <div style="padding:0 32px 24px 32px;background-color:#fdf7f0;">
        <p style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#111827;">🏡 Room-wise Laminate Selections</p>

        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:16px;">
          <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">Kitchen</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.8;color:#4b5563;">
            <li>Base Shutters: ${k.baseShutters || "[Brand – Code – Finish]"}</li>
            <li>Wall Shutters: ${k.wallShutters || "[Brand – Code – Finish]"}</li>
            <li>Tall Units: ${k.tallUnits || "[Code]"}</li>
            <li>Internal Finish: ${k.internalFinish || "[Code]"}</li>
            <li>Hinges &amp; Channels – brand &amp; type: ${k.hingesChannels || "[Brand - NSC/SC]"}</li>
            <li>Handles: ${k.handles || "[Code]"}</li>
          </ul>
        </div>

        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:16px;">
          <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">Master Bedroom</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.8;color:#4b5563;">
            <li>Wardrobe Shutters: ${mb.wardrobeShutters || "[Brand – Code – Finish]"}</li>
            <li>Loft Finish: ${mb.loftFinish || "[Code]"}</li>
            <li>Internal Finish: ${mb.internalFinish || "[Code]"}</li>
            <li>Hinges &amp; Channels – brand &amp; type: ${mb.hingesChannels || "[Brand - NSC/SC]"}</li>
            <li>Handles: ${mb.handles || "[Code]"}</li>
          </ul>
        </div>

        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:16px;">
          <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">Bedroom 2</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.8;color:#4b5563;">
            <li>Wardrobe Shutters: ${b2.wardrobeShutters || "[Code]"}</li>
            <li>Loft Finish: ${b2.loftFinish || "[Code]"}</li>
            <li>Internal Finish: ${b2.internalFinish || "[Code]"}</li>
            <li>Hinges &amp; Channels – brand &amp; type: ${b2.hingesChannels || "[Brand - NSC/SC]"}</li>
            <li>Handles: ${b2.handles || "[Code]"}</li>
          </ul>
        </div>

        <div style="background-color:#f8efdf;border-radius:18px;padding:18px 24px;box-shadow:0 6px 18px rgba(0,0,0,0.03);margin-bottom:20px;">
          <p style="margin:0 0 10px 0;font-size:14px;font-weight:600;color:#111827;">Living Room / TV Unit</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.8;color:#4b5563;">
            <li>Base Finish: ${lr.baseFinish || "[Code]"}</li>
            <li>Highlight / Accent: ${lr.highlightAccent || "[Code]"}</li>
          </ul>
        </div>

        <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#4b5563;">
          Please review the above and confirm if everything is aligned as discussed.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
          We will now incorporate these selections into the final drawings and proceed towards DQC 2 submission.
        </p>
      </div>

      <!-- Footer / Signature -->
      <div style="padding:20px 32px 26px 32px;background-color:#ffffff;">
        <p style="margin:0 0 4px 0;font-size:13px;color:#374151;">Warm regards,</p>
        <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:#111827;">${designerName}</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Team HUB</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
