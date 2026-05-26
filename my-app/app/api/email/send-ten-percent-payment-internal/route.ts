import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import TenPercentPaymentInternalEmail from '@/app/newEmail/templates/Internal/TenPercentPaymentInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !designerName || !ecName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, designerName, ecName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(TenPercentPaymentInternalEmail, {
      projectId,
      customerName,
      designerName,
      ecName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      subject: subjectOverride || 'DQC 1 Approved – Proceed with 10% Collection & Masking',
      html,
      ...(cc && cc.length ? { cc } : {}),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('10% payment internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send 10% payment internal email' },
      { status: 500 },
    );
  }
}

