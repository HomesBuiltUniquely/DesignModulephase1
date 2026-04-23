import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc2ApprovalInternalEmail } from '@/lib/email/render-dqc2-approval-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const designerName = body.designerName as string | undefined;
    const customerName = body.customerName as string | undefined;

    if (!to || !designerName || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, designerName, customerName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderDqc2ApprovalInternalEmail({
      designerName,
      customerName,
    });

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 approval internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 approval internal email' },
      { status: 500 },
    );
  }
}
