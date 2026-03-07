import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderDesignSignoff40pcPaymentApprovalEmail } from '@/lib/email/render-design-signoff-40pc-payment-approval';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectName = body.projectName as string | undefined;
    const amountReceived = body.amountReceived as string | undefined;
    const dateOfReceipt = body.dateOfReceipt as string | undefined;
    const modeOfPayment = body.modeOfPayment as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderDesignSignoff40pcPaymentApprovalEmail({
      customerName,
      projectName,
      amountReceived,
      dateOfReceipt,
      modeOfPayment,
    });

    const info = await sendMailForPayment({
      to,
      subject: 'Payment Receipt – 40% Milestone',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Design sign‑off 40% payment approval email error', error);
    return NextResponse.json(
      { error: 'Failed to send design sign‑off 40% payment approval email' },
      { status: 500 }
    );
  }
}

