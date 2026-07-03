import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import TenPercentPaymentRequestEmail from '@/app/newEmail/templates/External/TenPercentPaymentRequest';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const propertyType = body.propertyType as string | undefined;
    const amountDue = body.amountDue as string | undefined;
    const quotationTotal = body.quotationTotal as string | undefined;
    const milestoneTarget = body.milestoneTarget as string | undefined;
    const alreadyPaid = body.alreadyPaid as string | undefined;
    const dueDate = body.dueDate as string | undefined;
    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    const designerName = body.designerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(TenPercentPaymentRequestEmail, {
      customerName,
      projectId,
      propertyType,
      amountDue,
      quotationTotal,
      milestoneTarget,
      alreadyPaid,
      dueDate,
      designerName: designerName || 'Your Design Consultant',
    });

    const html = await render(emailComponent);

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Design Approved – Ready for Site Masking',
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

