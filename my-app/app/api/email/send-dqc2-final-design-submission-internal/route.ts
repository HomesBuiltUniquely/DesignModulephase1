import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc2FinalDesignSubmissionInternalEmail } from '@/lib/email/render-dqc2-final-design-submission-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | undefined;
    const customerName = body.customerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const dqcRepName = body.dqcRepName as string | undefined;
    const projectValue = body.projectValue as string | number | undefined;

    if (!to || !customerName || !ecName || !designerName || !dqcRepName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, ecName, designerName, dqcRepName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderDqc2FinalDesignSubmissionInternalEmail({
      dqcRepName,
      customerName,
      ecName,
      designerName,
      projectValue: projectValue != null ? String(projectValue) : undefined,
    });

    const info = await sendMail({
      to,
      subject,
      html,
      ...(cc && cc.length ? { cc } : {}),
    } as any);

    return NextResponse.json({ success: true, messageId: (info as any).messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 final design submission internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 final design submission internal email' },
      { status: 500 },
    );
  }
}
