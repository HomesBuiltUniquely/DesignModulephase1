import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import React from 'react';
import MeetingUpdateEmail, {
  type MeetingUpdateAction,
} from '@/app/newEmail/templates/External/MeetingUpdate';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const action = (body.action as MeetingUpdateAction | undefined) || 'rescheduled';
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const meetingTypeLabel = body.meetingTypeLabel as string | undefined;
    const stageName = body.stageName as string | undefined;
    const meetingDate = body.meetingDate as string | undefined;
    const meetingTime = body.meetingTime as string | undefined;
    const previousMeetingDate = body.previousMeetingDate as string | undefined;
    const previousMeetingTime = body.previousMeetingTime as string | undefined;
    const meetingMode = body.meetingMode as string | undefined;
    const meetingLink = body.meetingLink as string | undefined;
    const branchName = (body.branchName || body.ecLocation) as string | undefined;
    const designerName = body.designerName as string | undefined;
    const reason = body.reason as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    if (action !== 'rescheduled' && action !== 'cancelled') {
      return NextResponse.json({ error: 'action must be rescheduled or cancelled' }, { status: 400 });
    }

    const emailComponent = React.createElement(MeetingUpdateEmail, {
      action,
      customerName,
      projectId,
      meetingTypeLabel,
      stageName,
      meetingDate,
      meetingTime,
      previousMeetingDate,
      previousMeetingTime,
      meetingMode,
      meetingLink,
      branchName,
      designerName,
      reason,
    });

    const html = await render(emailComponent);
    const defaultSubject =
      action === 'cancelled' ? 'Meeting Cancelled' : 'Meeting Rescheduled';

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || defaultSubject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Meeting update email error', error);
    return NextResponse.json({ error: 'Failed to send meeting update email' }, { status: 500 });
  }
}
