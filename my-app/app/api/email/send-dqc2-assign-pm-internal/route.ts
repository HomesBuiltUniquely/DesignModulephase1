import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc2AssignPmInternalEmail } from '@/lib/email/render-dqc2-assign-pm-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectName = body.projectName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const designerName = body.designerName as string | undefined;
    const clientEmail = body.clientEmail as string | undefined;
    const clientPhone = body.clientPhone as string | undefined;
    const branchLocation = body.branchLocation as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderDqc2AssignPmInternalEmail({
      customerName,
      projectName,
      projectId,
      designerName,
      branchLocation,
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
    console.error('DQC2 assign PM internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 assign PM internal email' },
      { status: 500 },
    );
  }
}
