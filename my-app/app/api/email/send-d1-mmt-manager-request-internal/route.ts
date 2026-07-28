import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import D1MmtManagerRequestInternalEmail from '@/app/newEmail/templates/Internal/D1MmtManagerRequestInternal';
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
    const mmtManagerName = body.mmtManagerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const siteAddress = body.siteAddress as string | undefined;
    const visitDate = body.visitDate as string | null | undefined;
    const visitTime = body.visitTime as string | null | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(D1MmtManagerRequestInternalEmail, {
      projectId,
      customerName,
      designerName,
      mmtManagerName,
      ecName,
      siteAddress,
      visitDate,
      visitTime,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || `D1 MMT Request – Assign Executive – ${customerName}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 MMT manager request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send D1 MMT manager request email' },
      { status: 500 },
    );
  }
}
