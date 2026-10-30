import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import React from 'react';
import MeetingRescheduledEmail from '@/app/newEmail/templates/External/MeetingRescheduled';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | string[] | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const meetingTypeLabel = body.meetingTypeLabel as string | undefined;
    const previousDate = body.previousDate as string | undefined;
    const previousTime = body.previousTime as string | undefined;
    const newDate = body.newDate as string | undefined;
    const newTime = body.newTime as string | undefined;
    const meetingMode = body.meetingMode as string | undefined;
    const meetingLink = body.meetingLink as string | undefined;
    const branchName = body.branchName as string | undefined;
    const designerName = body.designerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(MeetingRescheduledEmail, {
      customerName,
      projectId,
      meetingTypeLabel,
      previousDate,
      previousTime,
      newDate,
      newTime,
      meetingMode,
      meetingLink,
      branchName,
      designerName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || `Meeting Rescheduled – ${meetingTypeLabel || 'HUB Interior'}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('meeting-rescheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send meeting rescheduled email' },
      { status: 500 },
    );
  }
}
