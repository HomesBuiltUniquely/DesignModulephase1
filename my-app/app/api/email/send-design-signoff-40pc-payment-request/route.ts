import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderDesignSignoff40pcPaymentRequestEmail } from '@/lib/email/render-design-signoff-40pc-payment-request';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const amount = body.amount as string | undefined;
    const accountName = body.accountName as string | undefined;
    const accountNumber = body.accountNumber as string | undefined;
    const ifscCode = body.ifscCode as string | undefined;
    const designerName = body.designerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderDesignSignoff40pcPaymentRequestEmail({
      customerName,
      amount,
      accountName,
      accountNumber,
      ifscCode,
      designerName,
    });

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Design Sign-Off Completed – 40% Milestone',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Design sign‑off 40% payment request email error', error);
    return NextResponse.json(
      { error: 'Failed to send design sign‑off 40% payment request email' },
      { status: 500 }
    );
  }
}

