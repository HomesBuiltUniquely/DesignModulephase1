import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';

function renderMailLoopChainInitiateEmail(params: {
  customerName: string;
  leadPayload: any;
}) {
  const { customerName, leadPayload } = params;
  const pd = leadPayload || {};
  const fData = pd.fetchedData ? pd.fetchedData : pd;
  const formData = pd.formData ? pd.formData : pd;

  const clientName = customerName || 'Customer';
  const clientFullName = fData.customer_name || clientName;
  const dateOfCall = formData.booking_date || '[Date]';
  const addressCity = formData.site_address || '[Address, City]';
  const projectType = formData.booking_type || '[New Home / Renovation]';
  const totalAmount = formData.order_value || '[Total Amount]';
  const salesConsultantName = fData.sales_spoc || '[Name]';
  const branch = formData.experience_center || '[Branch]';
  const salesConsultantInfo = `${salesConsultantName} · ${branch}`;
  
  const rm = salesConsultantName !== '[Name]' ? salesConsultantName.slice(0, 2).toUpperCase() : 'RM';
  const rmName = salesConsultantName !== '[Name]' ? salesConsultantName : '[Relationship Manager]';
  const rmPhone = fData.co_no || '[Phone]';
  const rmEmail = fData.sales_email || fData.email || '[Email]';

  const woodDiscount = formData.dis_on_woodwork ? `${formData.dis_on_woodwork}% off` : 'N/A';
  const bookingReceived = formData.payment_received || 'Pending';

  const today = new Date().toLocaleDateString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to HUB Interiors</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    .lx{max-width:640px;margin:1.5rem auto;font-family:Georgia,serif;color:#1a1a1a;line-height:1.8;font-size:14px;}
    .lx-header{background:#111111;border-radius:12px 12px 0 0;padding:0;}
    .lx-header-top{padding:1.75rem 2rem 0;display:flex;align-items:flex-start;justify-content:space-between;}
    .lx-logo{display:flex;flex-direction:column;gap:2px;}
    .lx-logo-name{color:#ffffff;font-size:20px;font-weight:400;letter-spacing:3px;text-transform:uppercase;font-family:Georgia,serif;}
    .lx-logo-name span{color:#C0392B;}
    .lx-logo-tag{color:#666;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;}
    .lx-ref{text-align:right;}
    .lx-ref p{font-size:11px;color:#555;letter-spacing:0.5px;line-height:1.6;}
    .lx-divline{height:0.5px;background:#C0392B;margin:1.25rem 2rem 0;}
    .lx-banner{padding:1.5rem 2rem 2rem;}
    .lx-banner-sub{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;margin-bottom:6px;}
    .lx-banner-title{font-size:26px;font-weight:400;color:#ffffff;letter-spacing:1px;line-height:1.3;}
    .lx-banner-title span{color:#C0392B;}
    .lx-body{background:#fafafa;border:0.5px solid #ddd;border-top:none;padding:2rem;}
    .lx-intro{font-size:14px;color:#2c2c2c;margin-bottom:1.75rem;line-height:1.9;}
    .sec-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#C0392B;margin-bottom:12px;display:flex;align-items:center;gap:10px;}
    .sec-label::after{content:'';flex:1;height:0.5px;background:#ddd;}
    .lx-divider{border:none;border-top:0.5px solid #e0e0e0;margin:1.75rem 0;}
    .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1px;background:#ddd;border:0.5px solid #ddd;border-radius:8px;overflow:hidden;margin-bottom:1.75rem;}
    .info-cell{background:#fafafa;padding:14px 16px;}
    .info-cell .ic-l{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:4px;}
    .info-cell .ic-v{font-size:13.5px;color:#1a1a1a;font-family:Georgia,serif;}
    .scope-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:1.75rem;table-layout:fixed;}
    .scope-tbl th{text-align:left;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;padding:0 0 10px;border-bottom:0.5px solid #C0392B;font-family:Arial,sans-serif;}
    .scope-tbl td{padding:11px 0;border-bottom:0.5px solid #ebebeb;vertical-align:top;color:#2c2c2c;font-family:Arial,sans-serif;font-size:13px;}
    .scope-tbl td:first-child{color:#888;width:38%;padding-right:12px;}
    .scope-tbl tr:last-child td{border-bottom:none;}
    .offer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:1.75rem;}
    .offer-card{border:0.5px solid #ddd;border-radius:8px;padding:16px;background:#fff;}
    .offer-card.red-accent{border-top:2px solid #C0392B;background:#fff;}
    .offer-card .oc-l{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:6px;font-family:Arial,sans-serif;}
    .offer-card .oc-v{font-size:17px;color:#111;font-family:Georgia,serif;}
    .offer-card.red-accent .oc-v{color:#C0392B;}
    .offer-card .oc-s{font-size:11px;color:#888;margin-top:4px;font-family:Arial,sans-serif;}
    .badge{display:inline-block;font-size:10px;letter-spacing:0.5px;padding:2px 8px;border-radius:20px;font-family:Arial,sans-serif;}
    .badge-confirmed{background:#f0f0f0;color:#444;border:0.5px solid #ccc;}
    .badge-conditional{background:#fff5f5;color:#A93226;border:0.5px solid #f5c6c6;}
    .freebie-list{list-style:none;margin-bottom:1.75rem;}
    .freebie-list li{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:0.5px solid #ebebeb;}
    .freebie-list li:last-child{border-bottom:none;}
    .freebie-rule{width:1.5px;background:#C0392B;align-self:stretch;flex-shrink:0;margin-top:3px;}
    .freebie-list .fl-n{font-size:13.5px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;}
    .freebie-list .fl-d{font-size:12px;color:#888;margin-top:3px;font-family:Arial,sans-serif;}
    .transp-box{border:0.5px solid #ddd;border-left:3px solid #111;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:1.75rem;background:#fff;}
    .transp-box strong{font-size:13px;color:#111;display:block;margin-bottom:4px;font-family:Georgia,serif;}
    .transp-box p{font-size:12.5px;color:#666;font-family:Arial,sans-serif;line-height:1.7;}
    .closing-text{font-size:13.5px;color:#555;margin-bottom:1.75rem;line-height:1.9;font-family:Arial,sans-serif;}
    .closing-quote{font-family:Georgia,serif;font-style:italic;font-size:13px;color:#888;border-left:2px solid #C0392B;padding-left:14px;margin:1.25rem 0;line-height:1.8;}
    .sig{display:flex;align-items:center;gap:16px;padding-top:1.25rem;border-top:0.5px solid #ddd;}
    .sig-av{width:42px;height:42px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;font-size:13px;color:#C0392B;font-family:Georgia,serif;flex-shrink:0;}
    .sig-name{font-size:14px;color:#111;font-family:Georgia,serif;}
    .sig-role{font-size:11px;color:#888;margin-top:2px;font-family:Arial,sans-serif;letter-spacing:0.3px;}
    .lx-footer{background:#111;border:0.5px solid #111;border-top:none;border-radius:0 0 12px 12px;padding:1.25rem 2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
    .lx-footer-q{font-size:11.5px;color:#555;font-style:italic;font-family:Georgia,serif;max-width:380px;line-height:1.7;}
    .ack-btn{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;background:#C0392B;color:#fff;border:none;border-radius:6px;padding:10px 18px;cursor:pointer;font-family:Arial,sans-serif;}
  </style>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;">
  <h2 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">HUB Interiors luxury welcome email template — red, black and grey, with full sales call record.</h2>

  <div class="lx">
    <div class="lx-header">
      <div class="lx-header-top">
        <div class="lx-logo">
          <div class="lx-logo-name">HUB <span>Interiors</span></div>
          <div class="lx-logo-tag">Homes Uniquely Built</div>
        </div>
        <div class="lx-ref">
          <p>${today}</p>
          <p>Ref: HUB-2025</p>
        </div>
      </div>
      <div class="lx-divline"></div>
      <div class="lx-banner">
        <div class="lx-banner-sub">Welcome to</div>
        <div class="lx-banner-title">Homes <span>Uniquely</span> Built</div>
      </div>
    </div>

    <div class="lx-body">
      <p class="lx-intro">Dear <strong>${clientName}</strong>,<br><br>
      We are honoured to welcome you to the HUB Interiors family. This letter is a complete written record of all that was discussed during your sales consultation on <strong>${dateOfCall}</strong> — a commitment to full transparency between us, from the very first day.</p>

      <div class="sec-label">Project overview</div>
      <div class="info-grid">
        <div class="info-cell"><div class="ic-l">Client name</div><div class="ic-v">${clientFullName}</div></div>
        <div class="info-cell"><div class="ic-l">Property address</div><div class="ic-v">${addressCity}</div></div>
        <div class="info-cell"><div class="ic-l">Project type</div><div class="ic-v">${projectType}</div></div>
        <div class="info-cell"><div class="ic-l">Scope of work</div><div class="ic-v">Woodwork · Kitchen · Flooring · Civil</div></div>
        <div class="info-cell"><div class="ic-l">Project value</div><div class="ic-v">₹${totalAmount}</div></div>
        <div class="info-cell"><div class="ic-l">Sales consultant</div><div class="ic-v">${salesConsultantInfo}</div></div>
      </div>

      <hr class="lx-divider">

      <div class="sec-label">Offer confirmed</div>
      <div class="offer-grid">
        <div class="offer-card red-accent">
          <div class="oc-l">Woodwork discount</div>
          <div class="oc-v">${woodDiscount}</div>
          <div class="oc-s">Applied to full woodwork scope</div>
        </div>
        <div class="offer-card red-accent">
          <div class="oc-l">Early handover</div>
          <div class="oc-v">15 days early</div>
          <div class="oc-s">If signed by [Date] &nbsp;<span class="badge badge-conditional">Conditional</span></div>
        </div>
        <div class="offer-card">
          <div class="oc-l">Booking received</div>
          <div class="oc-v">${bookingReceived}</div>
          <div class="oc-s">On ${dateOfCall} &nbsp;<span class="badge badge-confirmed">Confirmed</span></div>
        </div>
        <div class="offer-card">
          <div class="oc-l">Quote validity</div>
          <div class="oc-v">6 months</div>
          <div class="oc-s">Standard validity</div>
        </div>
      </div>

      <hr class="lx-divider">

      <div class="sec-label">Freebies &amp; complimentary inclusions</div>
      <ul class="freebie-list">
        <li>
          <div class="freebie-rule"></div>
          <div>
            <div class="fl-n">Complimentary design consultation &nbsp;<span class="badge badge-confirmed">Included</span></div>
            <div class="fl-d">3 rounds of design revisions at no additional charge</div>
          </div>
        </li>
        <li>
          <div class="freebie-rule"></div>
          <div>
            <div class="fl-n">Modular kitchen accessories &nbsp;<span class="badge badge-confirmed">Included</span></div>
            <div class="fl-d">Soft-close hinges, pull-out baskets &amp; cutlery tray (standard range)</div>
          </div>
        </li>
        <li>
          <div class="freebie-rule"></div>
          <div>
            <div class="fl-n">Site visit &amp; measurement &nbsp;<span class="badge badge-confirmed">Included</span></div>
            <div class="fl-d">Scheduled within 7 working days of booking confirmation</div>
          </div>
        </li>
        <li>
          <div class="freebie-rule"></div>
          <div>
            <div class="fl-n">Curtain rods &amp; installation &nbsp;<span class="badge badge-conditional">Conditional</span></div>
            <div class="fl-d">Applicable only if curtain work is included in final scope</div>
          </div>
        </li>
      </ul>

      <hr class="lx-divider">

      <div class="sec-label">Sales call — terms on record</div>
      <div class="transp-box">
        <strong>Transparent sales call summary</strong>
        <p>The following points were verbally agreed upon and are now formally documented for mutual reference.</p>
      </div>
      <table class="scope-tbl">
        <thead><tr><th style="width:38%">Term</th><th>Detail agreed upon</th></tr></thead>
        <tbody>
          <tr><td>Payment schedule</td><td>30% booking · 40% at execution start · 30% on handover</td></tr>
          <tr><td>Warranty</td><td>10 years on woodwork · 1 year on civil &amp; electrical</td></tr>
          <tr><td>Materials &amp; brands</td><td>Greenply / Century (ply) · Hettich (hardware) · Standard laminates</td></tr>
          <tr><td>Project timeline</td><td>Estimated from design sign-off</td></tr>
          <tr><td>Delay penalty</td><td>Standard deduction per week beyond agreed handover date</td></tr>
          <tr><td>Scope changes</td><td>Post-execution changes subject to revised pricing &amp; timeline</td></tr>
        </tbody>
      </table>

      <hr class="lx-divider">

      <p class="closing-text">We trust this letter provides complete clarity on every commitment made. Should you wish to revisit any point, your dedicated relationship manager is always available.</p>

      <div class="closing-quote">"Your experience defines our service — and every design we create is uniquely yours."<br>"Loved your experience? Share it. Didn't? Tell us — we will make it right."</div>

      <div class="sig">
        <div class="sig-av">${rm}</div>
        <div>
          <div class="sig-name">${rmName}</div>
          <div class="sig-role">Client Relationship Manager · HUB Interiors</div>
          <div class="sig-role">${rmPhone} &nbsp;·&nbsp; ${rmEmail}</div>
        </div>
      </div>
    </div>

    <div class="lx-footer">
      <div class="lx-footer-q">Kindly acknowledge receipt of this letter to confirm your understanding of all terms discussed.</div>
      <button class="ack-btn">Acknowledge &amp; confirm</button>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const leadPayload = body.leadPayload;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const html = renderMailLoopChainInitiateEmail({ customerName, leadPayload });
    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Welcome to HUB Interiors',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Mail loop chain initiate send error', error);
    return NextResponse.json(
      { error: 'Failed to send mail loop chain initiate email' },
      { status: 500 },
    );
  }
}
