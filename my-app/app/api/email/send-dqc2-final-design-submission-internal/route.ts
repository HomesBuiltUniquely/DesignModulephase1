import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC2FinalDesignSubmissionInternalEmail from '@/app/newEmail/templates/Internal/DQC2FinalDesignSubmissionInternal';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const dqcRepName = body.dqcRepName as string | undefined;
    const projectValue = body.projectValue as string | number | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !ecName || !designerName || !dqcRepName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, dqcRepName' },
        { status: 400 },
      );
    }

    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    const emailComponent = React.createElement(DQC2FinalDesignSubmissionInternalEmail, {
      projectId,
      dqcRepName,
      customerName,
      ecName,
      designerName,
      projectValue: projectValue != null ? String(projectValue) : undefined,
      attachments,
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      subject: subjectOverride || `DQC 2 Review Request – ${customerName} – ${ecName}`,
      html,
      ...(cc && cc.length ? { cc } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 final design submission internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 final design submission internal email' },
      { status: 500 },
    );
  }
}
