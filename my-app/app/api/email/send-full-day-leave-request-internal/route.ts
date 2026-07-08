import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import FullDayLeaveRequestInternalEmail from '@/app/newEmail/templates/Internal/FullDayLeaveRequestInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const recipientName = body.recipientName as string | undefined;
    const requestedByName = body.requestedByName as string | undefined;
    const requestedByRole = body.requestedByRole as string | undefined;
    const blockDate = body.blockDate as string | undefined;
    const reason = body.reason as string | undefined;
    const reasonPreset = body.reasonPreset as string | undefined;

    if (!to || !requestedByName || !blockDate || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: to, requestedByName, blockDate, reason' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(FullDayLeaveRequestInternalEmail, {
      recipientName: recipientName || 'Approver',
      requestedByName,
      requestedByRole: requestedByRole || 'Designer',
      blockDate,
      reason,
      reasonPreset,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      cc,
      subject: subjectOverride || `Full-day leave request – ${requestedByName} · ${blockDate}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Full-day leave request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send full-day leave request email' },
      { status: 500 },
    );
  }
}
