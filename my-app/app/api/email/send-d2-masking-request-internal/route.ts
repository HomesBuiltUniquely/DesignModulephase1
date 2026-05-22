import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import D2MaskingRequestInternalEmail from '@/app/newEmail/templates/Internal/D2MaskingRequestInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const maskingDate = body.maskingDate as string | null | undefined;
    const maskingTime = body.maskingTime as string | null | undefined;
    const mmtName = body.mmtName as string | undefined;
    const pmName = body.pmName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !designerName || !ecName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, designerName, ecName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(D2MaskingRequestInternalEmail, {
      projectId,
      customerName,
      designerName,
      ecName,
      mmtName,
      pmName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      subject: `D2 Site Masking Request – ${customerName} – ${ecName}`,
      html,
      ...(cc && cc.length ? { cc } : {}),
    } as any);

    return NextResponse.json({ success: true, messageId: (info as any).messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D2 masking request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send D2 masking request internal email' },
      { status: 500 },
    );
  }
}
