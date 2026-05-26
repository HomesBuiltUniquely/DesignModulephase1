import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DesignSignoff40pcPaymentRequestEmail from '@/app/newEmail/templates/External/DesignSignoff40pcPaymentRequest';
import React from 'react';

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
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(DesignSignoff40pcPaymentRequestEmail, {
      customerName,
      projectId,
      amount,
      accountName,
      accountNumber,
      ifscCode,
      designerName,
    });

    const html = await render(emailComponent);

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

