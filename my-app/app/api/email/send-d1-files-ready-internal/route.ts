import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import D1FilesReadyInternalEmail from '@/app/newEmail/templates/Internal/D1FilesReadyInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const projectId = body.projectId as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const approvedByName = body.approvedByName as string | undefined;
    const fileName = body.fileName as string | null | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(D1FilesReadyInternalEmail, {
      projectId,
      customerName,
      designerName,
      approvedByName,
      fileName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || `D1 Files Uploaded – ${customerName}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 files ready internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send D1 files ready email' },
      { status: 500 },
    );
  }
}
