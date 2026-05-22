import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import TenPercentPaymentApprovalEmail from '@/app/newEmail/templates/External/TenPercentPaymentApproval';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const amountPaid = body.amountPaid as string | undefined;
    const paymentDate = body.paymentDate as string | undefined;
    const transactionRef = body.transactionRef as string | undefined;
    const designerName = body.designerName as string | undefined;
    const totalProjectValue = body.totalProjectValue as string | number | undefined;
    const paymentMode = body.paymentMode as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    const emailComponent = React.createElement(TenPercentPaymentApprovalEmail, {
      customerName,
      projectId,
      amountPaid,
      paymentDate,
      transactionRef,
      designerName,
      totalProjectValue,
      paymentMode,
    });

    const html = await render(emailComponent);

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || '10% Payment Confirmation',
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
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

