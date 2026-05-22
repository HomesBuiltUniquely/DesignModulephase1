import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import Dqc2PmReviewRequestInternalEmail from '@/app/newEmail/templates/Internal/Dqc2PmReviewRequestInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const pmName = body.pmName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !pmName || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, pmName, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(Dqc2PmReviewRequestInternalEmail, {
      projectId,
      pmName,
      customerName,
      designerName,
      ecName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || 'Action Required: DQC 2 Approved – Project PM Review Needed',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 PM review request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 PM review request internal email' },
      { status: 500 },
    );
  }
}
