import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc2MaterialSelectionScheduledEmail } from '@/lib/email/render-dqc2-material-selection-scheduled';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const meetingDate = body.meetingDate as string | null | undefined;
    const meetingTime = body.meetingTime as string | null | undefined;
    const ecLocation = body.ecLocation as string | null | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const { subject, html } = renderDqc2MaterialSelectionScheduledEmail({
      customerName,
      designerName,
      meetingDate,
      meetingTime,
      ecLocation,
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
    console.error('DQC2 material selection scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 material selection scheduled email' },
      { status: 500 }
    );
  }
}
