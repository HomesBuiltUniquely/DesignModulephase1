import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC1MOMTemplate from '@/app/newEmail/templates/External/DQC1MOMTemplate';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      to,
      cc,
      subject,
      customerName,
      projectId,
      designerName,
      meetingDate,
      meetingTime,
      attendees,
      discussionSummary,
      attachments,
      stageName,
      statusName,
      title,
      introText,
    } = body;

    // We can support customerEmail as an alias for to, if invoked directly via old format
    const targetEmail = to || body.customerEmail;

    if (!targetEmail) {
      return NextResponse.json({ error: 'Missing required field: to (or customerEmail)' }, { status: 400 });
    }

    const emailComponent = React.createElement(DQC1MOMTemplate, {
      customerName: customerName || 'Customer',
      projectId: projectId || 'HI-2025-0000',
      designerName: designerName || 'Your Design Consultant',
      meetingDate,
      meetingTime,
      attendees,
      discussionSummary,
      attachments,
      stageName,
      statusName,
      title,
      introText,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to: String(targetEmail),
      ...(cc ? { cc } : {}),
      subject: subject || `Timeline Update - HUB ${projectId || ''}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Project file timeline email send error', error);
    return NextResponse.json({ error: 'Failed to send project timeline email' }, { status: 500 });
  }
}
