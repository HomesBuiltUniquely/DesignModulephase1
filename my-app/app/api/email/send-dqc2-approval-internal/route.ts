import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC2ApprovalInternalEmail from '@/app/newEmail/templates/Internal/DQC2ApprovalInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const designerName = body.designerName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !designerName || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, designerName, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(DQC2ApprovalInternalEmail, {
      projectId,
      designerName,
      customerName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || 'Action Required – DQC 2 Cleared',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 approval internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 approval internal email' },
      { status: 500 },
    );
  }
}
