import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import ProductionApprovalRequestEmail from '@/app/newEmail/templates/External/ProductionApprovalRequest';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(ProductionApprovalRequestEmail, {
      customerName,
      projectId,
      designerName,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Final Approval Required – Production Initiation',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Production approval request email error', error);
    return NextResponse.json(
      { error: 'Failed to send production approval request email' },
      { status: 500 }
    );
  }
}

