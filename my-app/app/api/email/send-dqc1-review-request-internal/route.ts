import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc1ReviewRequestInternalEmail } from '@/lib/email/render-dqc1-review-request-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to = body.to as string | undefined;
    const cc = body.cc as string[] | undefined;
    const customerName = body.customerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectValue = body.projectValue as string | number | undefined;
    const dqcRepName = body.dqcRepName as string | undefined;
    const drawingFileName = body.drawingFileName as string | undefined;
    const quotationFileName = body.quotationFileName as string | undefined;

    const hasProjectValue =
      projectValue !== undefined &&
      projectValue !== null &&
      String(projectValue).trim() !== '';

    if (!to || !customerName || !ecName || !designerName || !hasProjectValue || !dqcRepName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, projectValue, dqcRepName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderDqc1ReviewRequestInternalEmail({
      dqcRepName,
      customerName,
      ecName,
      designerName,
      projectValue: String(projectValue),
      drawingFileName,
      quotationFileName,
    });

    const info = await sendMail({
      to,
      cc,
      subject,
      html,
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

