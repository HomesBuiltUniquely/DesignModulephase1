import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc1FirstCutDesignScheduledEmail } from '@/lib/email/render-dqc1-first-cut-design-scheduled';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const meetingDate = body.meetingDate as string | undefined;
    const meetingTime = body.meetingTime as string | undefined;
    const designerName = body.designerName as string | undefined;
    const designerTitle = body.designerTitle as string | undefined;
    const designerAvatarUrl = body.designerAvatarUrl as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderDqc1FirstCutDesignScheduledEmail({
      customerName,
      meetingDate,
      meetingTime,
      designerName,
      designerTitle,
      designerAvatarUrl,
    });

    const info = await sendMail({
      to,
      subject: 'DQC1 – First Cut Design Presentation Scheduled',
      html,
    });

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

