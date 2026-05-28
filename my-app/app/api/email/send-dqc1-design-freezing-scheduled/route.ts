import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC1DesignFreezingScheduledEmail from '@/app/newEmail/templates/External/DQC1DesignFreezingScheduled';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const meetingDate = body.meetingDate as string | undefined;
    const meetingTime = body.meetingTime as string | undefined;
    const meetingMode = body.meetingMode as string | undefined;
    const meetingLink = body.meetingLink as string | undefined;
    const branchName = body.ecLocation as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(DQC1DesignFreezingScheduledEmail, {
      customerName,
      projectId,
      meetingDate,
      meetingTime,
      meetingMode,
      meetingLink,
      branchName,
      designerName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'DQC1 – Design Freezing Session Scheduled',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC1 design freezing scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC1 design freezing scheduled email' },
      { status: 500 }
    );
  }
}

