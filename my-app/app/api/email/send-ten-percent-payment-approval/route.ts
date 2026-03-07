import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderTenPercentPaymentApprovalEmail } from '@/lib/email/render-ten-percent-payment-approval';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const amountPaid = body.amountPaid as string | undefined;
    const paymentDate = body.paymentDate as string | undefined;
    const transactionRef = body.transactionRef as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderTenPercentPaymentApprovalEmail({
      customerName,
      projectId,
      amountPaid,
      paymentDate,
      transactionRef,
    });

    const info = await sendMail({
      to,
      subject: '10% Payment Confirmation',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('10% payment approval email error', error);
    return NextResponse.json(
      { error: 'Failed to send 10% payment approval email' },
      { status: 500 }
    );
  }
}

