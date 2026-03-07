import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderTenPercentPaymentRequestEmail } from '@/lib/email/render-ten-percent-payment-request';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const propertyType = body.propertyType as string | undefined;
    const amountDue = body.amountDue as string | undefined;
    const dueDate = body.dueDate as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderTenPercentPaymentRequestEmail({
      customerName,
      projectId,
      propertyType,
      amountDue,
      dueDate,
    });

    const info = await sendMailForPayment({
      to,
      subject: 'Design Approved – Ready for Site Masking',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('10% payment request email error', error);
    return NextResponse.json(
      { error: 'Failed to send 10% payment request email' },
      { status: 500 }
    );
  }
}

