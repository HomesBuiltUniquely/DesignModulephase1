import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DesignSignoff40pcPaymentApprovalEmail from '@/app/newEmail/templates/External/DesignSignoff40pcPaymentApproval';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectName = body.projectName as string | undefined;
    const amountReceived = body.amountReceived as string | undefined;
    const dateOfReceipt = body.dateOfReceipt as string | undefined;
    const modeOfPayment = body.modeOfPayment as string | undefined;
    const projectId = body.projectId as string | undefined;
    const designerName = body.designerName as string | undefined;
    const totalProjectValue = body.totalProjectValue as string | number | undefined;
    const transactionRef = body.transactionRef as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    const emailComponent = React.createElement(DesignSignoff40pcPaymentApprovalEmail, {
      customerName,
      projectId,
      projectName,
      amountReceived,
      dateOfReceipt,
      modeOfPayment,
      totalProjectValue,
      transactionRef,
    });

    const html = await render(emailComponent);

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Payment Receipt – 40% Milestone',
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
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

