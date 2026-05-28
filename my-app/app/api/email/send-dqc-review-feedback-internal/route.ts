import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DqcReviewFeedbackInternal from '@/app/newEmail/templates/Internal/DqcReviewFeedbackInternal';
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
    const verdict = body.verdict as string | undefined;
    const submissionVariant = body.submissionVariant as 'dqc1' | 'dqc2' | undefined;
    const remarks = body.remarks as { priority: string; text: string }[] | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !ecName || !designerName || !dqcRepName || !verdict) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, dqcRepName, verdict' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(DqcReviewFeedbackInternal, {
      projectId,
      customerName,
      ecName,
      designerName,
      dqcRepName,
      verdict,
      submissionVariant,
      remarks,
    });

    const html = await render(emailComponent);

    const stageNum = submissionVariant === 'dqc2' ? 'DQC2' : 'DQC1';
    const statusText = verdict === 'rejected' ? 'Rejected' : 'Comments Added';
    const defaultSubject = `${stageNum} Review Feedback: ${statusText} – ${customerName} – ${ecName}`;

    const info = await sendMail({
      to,
      cc,
      subject: subjectOverride || defaultSubject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC review feedback internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC review feedback internal email' },
      { status: 500 },
    );
  }
}
