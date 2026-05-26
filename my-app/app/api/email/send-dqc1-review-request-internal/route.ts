import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC1ReviewRequestInternalEmail from '@/app/newEmail/templates/Internal/DQC1ReviewRequestInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const attachments = body.attachments as { filename: string; path: string }[] | undefined;
    const customerName = body.customerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectValue = body.projectValue as string | number | undefined;
    const dqcRepName = body.dqcRepName as string | undefined;
    const drawingFileName = body.drawingFileName as string | undefined;
    const quotationFileName = body.quotationFileName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !ecName || !designerName || !dqcRepName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, dqcRepName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(DQC1ReviewRequestInternalEmail, {
      projectId,
      dqcRepName,
      customerName,
      ecName,
      designerName,
      projectValue: projectValue != null && String(projectValue).trim() !== '' ? String(projectValue) : undefined,
      drawingFileName,
      quotationFileName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      cc,
      subject: subjectOverride || `HUB-${projectId ? projectId + ' , ' : ''}${customerName || 'CUSTOMER'} DESIGN JOURNEY`.replace(/\s+/g, ' ').trim(),
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC1 review request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC1 review request internal email' },
      { status: 500 },
    );
  }
}

