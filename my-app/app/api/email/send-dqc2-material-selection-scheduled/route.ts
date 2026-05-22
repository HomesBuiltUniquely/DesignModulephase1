import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC2MaterialSelectionScheduledEmail from '@/app/newEmail/templates/External/DQC2MaterialSelectionScheduled';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const meetingDate = body.meetingDate as string | null | undefined;
    const meetingTime = body.meetingTime as string | null | undefined;
    const ecLocation = body.ecLocation as string | null | undefined;
    const meetingMode = body.meetingMode as string | null | undefined;
    const meetingLink = body.meetingLink as string | null | undefined;
    const attachments = body.attachments as { filename: string; path: string }[] | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(DQC2MaterialSelectionScheduledEmail, {
      customerName,
      designerName,
      meetingDate: meetingDate || undefined,
      meetingTime: meetingTime || undefined,
      meetingMode: meetingMode || undefined,
      meetingLink: meetingLink || undefined,
      branchName: ecLocation || undefined,
      projectId,
      attachments,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || 'Color & Material Selection Meeting – Scheduled',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 material selection scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 material selection scheduled email' },
      { status: 500 }
    );
  }
}
