import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import FullDayLeaveApprovedEmail from '@/app/newEmail/templates/Internal/FullDayLeaveApproved';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const recipientName = body.recipientName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const blockDate = body.blockDate as string | undefined;
    const reason = body.reason as string | undefined;
    const reasonPreset = body.reasonPreset as string | undefined;
    const approvedByName = body.approvedByName as string | undefined;

    if (!to || !designerName || !blockDate || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: to, designerName, blockDate, reason' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(FullDayLeaveApprovedEmail, {
      recipientName: recipientName || designerName,
      designerName,
      blockDate,
      reason,
      reasonPreset,
      approvedByName: approvedByName || 'Manager',
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      cc,
      subject: subjectOverride || `Full-day leave approved – ${blockDate}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Full-day leave approved email error', error);
    return NextResponse.json(
      { error: 'Failed to send full-day leave approved email' },
      { status: 500 },
    );
  }
}
