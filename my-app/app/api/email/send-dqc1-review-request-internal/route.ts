import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc1ReviewRequestInternalEmail } from '@/lib/email/render-dqc1-review-request-internal';

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

    if (!to || !customerName || !ecName || !designerName || !dqcRepName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, dqcRepName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderDqc1ReviewRequestInternalEmail({
      dqcRepName,
      customerName,
      ecName,
      designerName,
      projectValue: projectValue != null && String(projectValue).trim() !== '' ? String(projectValue) : undefined,
      drawingFileName,
      quotationFileName,
    });

    const info = await sendMail({
      to,
      cc,
      subject: subjectOverride || subject,
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

