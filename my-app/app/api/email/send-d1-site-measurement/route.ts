import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderD1SiteMeasurementEmail } from '@/lib/email/render-d1-site-measurement';

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
        { status: 400 }
      );
    }

    const html = renderD1SiteMeasurementEmail({ customerName });

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Welcome to HUB Interior – D1 Site Measurement',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 email send error', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

