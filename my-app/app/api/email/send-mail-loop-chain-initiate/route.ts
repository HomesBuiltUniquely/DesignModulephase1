import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';

function renderMailLoopChainInitiateEmail(params: { customerName: string }) {
  const { customerName } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Design Discussion</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">
          <tr>
            <td style="padding:24px;font-size:14px;line-height:1.7;">
              <p style="margin:0 0 12px 0;">Dear ${customerName},</p>
              <p style="margin:0 0 12px 0;">
                We have initiated your project design discussion mail thread.
              </p>
              <p style="margin:0 0 12px 0;">
                All upcoming design communication and updates will continue in this same thread.
              </p>
              <p style="margin:0;">
                Warm regards,<br/>
                Team HUB Interior
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const html = renderMailLoopChainInitiateEmail({ customerName });
    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Project Design Discussion',
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

