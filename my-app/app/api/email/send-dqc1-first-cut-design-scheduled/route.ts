import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import DQC1FirstCutDesignEmail from '@/app/newEmail/templates/DQC1FirstCutDesign';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const meetingDate = body.meetingDate as string | undefined;
    const meetingTime = body.meetingTime as string | undefined;
    const meetingMode = body.meetingMode as string | undefined;
    const meetingLink = body.meetingLink as string | undefined;
    const designerName = body.designerName as string | undefined;
    const designerTitle = body.designerTitle as string | undefined;
    const designerAvatarUrl = body.designerAvatarUrl as string | undefined;
    const projectId = body.projectId as string | undefined;
    const branchName = body.branchName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const attachments = body.attachments as { filename: string; path: string }[] | undefined;

    const html = await render(
      DQC1FirstCutDesignEmail({
        customerName,
        projectId,
        meetingDate,
        meetingTime,
        meetingMode,
        meetingLink,
        branchName,
        designerName,
      })
    );

    let info;
    try {
      info = await sendMail({
        to,
        ...(cc ? { cc } : {}),
        subject: subject || 'DQC1 – First Cut Design Presentation Scheduled',
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
      });
    } catch (sendErr) {
      // eslint-disable-next-line no-console
      console.warn('Failed to send DQC1 First Cut Design with attachments, retrying without...', sendErr);
      if (attachments && attachments.length) {
        info = await sendMail({
          to,
          ...(cc ? { cc } : {}),
          subject: subject || 'DQC1 – First Cut Design Presentation Scheduled',
          html,
        });
      } else {
        throw sendErr;
      }
    }

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC1 first cut design scheduled email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC1 first cut design scheduled email' },
      { status: 500 }
    );
  }
}
