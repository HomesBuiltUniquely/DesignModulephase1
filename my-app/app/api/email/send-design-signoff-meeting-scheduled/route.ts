import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDesignSignoffMeetingScheduledEmail } from '@/lib/email/render-design-signoff-meeting-scheduled';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const meetingDate = body.meetingDate as string | undefined;
    const meetingTime = body.meetingTime as string | undefined;
    const designerName = body.designerName as string | undefined;
    const meetingMode = body.meetingMode as 'online' | 'offline' | undefined;
    const meetingLink = body.meetingLink as string | undefined;
    const ecLocation = body.ecLocation as string | undefined;
    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const { subject, html } = renderDesignSignoffMeetingScheduledEmail({
      customerName,
      projectId,
      meetingDate,
      meetingTime,
      designerName,
      meetingMode,
      meetingLink,
      ecLocation,
    });

    let info;
    try {
      info = await sendMail({
        to,
        ...(cc ? { cc } : {}),
        subject: subjectOverride || subject,
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
      });
    } catch (sendErr) {
      // eslint-disable-next-line no-console
      console.warn('Failed to send with attachments, retrying without attachments...', sendErr);
      if (attachments && attachments.length) {
        info = await sendMail({
          to,
          ...(cc ? { cc } : {}),
          subject: subjectOverride || subject,
          html,
        });
      } else {
        throw sendErr;
      }
    }

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Design sign‑off meeting scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send design sign‑off meeting scheduled email' },
      { status: 500 }
    );
  }
}
