import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import PaymentUploadedInternalEmail from '@/app/newEmail/templates/Internal/PaymentUploadedInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const milestoneName = body.milestoneName as string | undefined;
    const fileNames = body.fileNames as string[] | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(PaymentUploadedInternalEmail, {
      projectId,
      customerName,
      designerName,
      milestoneName,
      fileNames,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      subject: subject || `Payment Uploaded for Verification - Project ${projectId || ''}`,
      html,
      ...(cc ? { cc } : {}),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Payment uploaded internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send payment uploaded internal email' },
      { status: 500 },
    );
  }
}
