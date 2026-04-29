import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderPmAssignmentNotificationEmail } from '@/lib/email/render-pm-assignment-notification';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const pmName = body.pmName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectName = body.projectName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const designerName = body.designerName as string | undefined;
    const branchLocation = body.branchLocation as string | undefined;

    if (!to || !customerName || !pmName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, pmName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderPmAssignmentNotificationEmail({
      pmName,
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
    console.error('PM assignment notification email error', error);
    return NextResponse.json(
      { error: 'Failed to send PM assignment notification email' },
      { status: 500 },
    );
  }
}
