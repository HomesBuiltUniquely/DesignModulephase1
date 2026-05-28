import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import D1MMTVisitScheduledEmail from '@/app/newEmail/templates/External/D1MMTVisitScheduled';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const siteAddress = body.siteAddress as string | undefined;
    const visitDate = body.visitDate as string | undefined;
    const visitTime = body.visitTime as string | undefined;
    const executiveName = body.executiveName as string | undefined;
    const executivePhone = body.executivePhone as string | undefined;
    const designerName = body.designerName as string | undefined;
    const designerEmail = body.designerEmail as string | undefined;
    const subject = body.subject as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(D1MMTVisitScheduledEmail, {
      customerName,
      projectId,
      visitDate,
      visitTime,
      executiveName,
      executivePhone,
      designerName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'D1 – Measurement Visit Scheduled',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 MMT visit scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send D1 MMT visit scheduled email' },
      { status: 500 }
    );
  }
}

