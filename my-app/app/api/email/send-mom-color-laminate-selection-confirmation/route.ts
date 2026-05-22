import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import MomColorLaminateSelectionConfirmationEmail from '@/app/newEmail/templates/External/MomColorLaminateSelectionConfirmation';
import { type LaminateSelections } from '@/lib/email/render-mom-color-laminate-selection-confirmation';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const laminateSelections = body.laminateSelections as LaminateSelections | undefined;
    const attachments = body.attachments as { filename: string; path: string }[] | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(MomColorLaminateSelectionConfirmationEmail, {
      projectId,
      customerName,
      designerName,
      laminateSelections: laminateSelections ?? undefined,
      attachments,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || 'MOM – Color & Laminate Selection Confirmation',
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('MOM color laminate selection confirmation email error', error);
    return NextResponse.json(
      { error: 'Failed to send MOM color laminate selection confirmation email' },
      { status: 500 }
    );
  }
}
