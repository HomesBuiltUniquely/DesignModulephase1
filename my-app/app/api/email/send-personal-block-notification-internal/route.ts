import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import PersonalBlockNotificationInternalEmail from '@/app/newEmail/templates/Internal/PersonalBlockNotificationInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const recipientName = body.recipientName as string | undefined;
    const bookedByName = body.bookedByName as string | undefined;
    const bookedByRole = body.bookedByRole as string | undefined;
    const appointmentDate = body.appointmentDate as string | undefined;
    const timeRange = body.timeRange as string | undefined;
    const durationMinutes = body.durationMinutes as number | undefined;
    const reason = body.reason as string | undefined;
    const reasonPreset = body.reasonPreset as string | undefined;

    if (!to || !bookedByName || !appointmentDate || !timeRange || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: to, bookedByName, appointmentDate, timeRange, reason' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(PersonalBlockNotificationInternalEmail, {
      recipientName: recipientName || 'Team Member',
      bookedByName,
      bookedByRole: bookedByRole || 'Designer',
      appointmentDate,
      timeRange,
      durationMinutes: durationMinutes ?? 90,
      reason,
      reasonPreset,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      cc,
      subject:
        subjectOverride ||
        `Personal time block – ${bookedByName} · ${appointmentDate} · ${timeRange}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Personal block notification internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send personal block notification email' },
      { status: 500 },
    );
  }
}
