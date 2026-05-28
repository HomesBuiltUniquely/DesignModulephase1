import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC2AssignPmInternalEmail from '@/app/newEmail/templates/Internal/DQC2AssignPmInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectName = body.projectName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const designerName = body.designerName as string | undefined;
    const branchLocation = body.branchLocation as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(DQC2AssignPmInternalEmail, {
      projectId,
      customerName,
      projectName,
      designerName,
      branchLocation,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || `Action Required – Assign Project Manager for ${customerName}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 assign PM internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 assign PM internal email' },
      { status: 500 },
    );
  }
}
