import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import PaymentLinkCancelledEmail from '@/app/newEmail/templates/External/PaymentLinkCancelled';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const amountDue = body.amountDue as string | undefined;
    const milestoneLabel = body.milestoneLabel as string | undefined;
    const designerName = body.designerName as string | undefined;
    const actionLabel = (body.actionLabel as string | undefined) || 'cancelled';

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(PaymentLinkCancelledEmail, {
      customerName,
      projectId,
      amountDue,
      milestoneLabel: milestoneLabel || 'Design payment',
      designerName: designerName || 'Your Design Consultant',
      actionLabel,
    });

    const html = await render(emailComponent);

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'HUB Interior – Payment link cancelled (do not use old link)',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('payment-link-cancelled email error', error);
    return NextResponse.json(
      { error: 'Failed to send payment-link-cancelled email' },
      { status: 500 },
    );
  }
}
