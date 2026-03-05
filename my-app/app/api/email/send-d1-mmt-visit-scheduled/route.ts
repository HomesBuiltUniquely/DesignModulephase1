import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderD1MmtVisitScheduledEmail } from '@/lib/email/render-d1-mmt-visit-scheduled';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const visitDate = body.visitDate as string | undefined;
    const visitTime = body.visitTime as string | undefined;
    const executiveName = body.executiveName as string | undefined;
    const executivePhone = body.executivePhone as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderD1MmtVisitScheduledEmail({
      customerName,
      visitDate,
      visitTime,
      executiveName,
      executivePhone,
    });

    const info = await sendMail({
      to,
      subject: 'D1 – Measurement Visit Scheduled',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 MMT visit scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send D1 MMT visit scheduled email' },
      { status: 500 }
    );
  }
}

