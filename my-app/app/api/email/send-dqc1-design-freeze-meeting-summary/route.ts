import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderGenericMilestoneEmail } from '@/lib/email/render-generic-milestone';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderGenericMilestoneEmail({
      customerName,
      title: 'DQC1 – Design Freeze Meeting Summary',
      intro:
        'Thank you for attending the design freeze discussion. Here is a summary of what was aligned and how we will move forward.',
      bulletPoints: [
        'Key layout and design decisions agreed during the meeting.',
        'Open points (if any) that will be refined before final sign‑off.',
        'Next steps towards budget confirmation and documentation.',
      ],
      ctaLabel: 'View Design Freeze Summary',
    });

    const info = await sendMail({
      to,
      subject: 'DQC1 – Design Freeze Meeting Summary',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC1 design freeze meeting summary email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC1 design freeze meeting summary email' },
      { status: 500 }
    );
  }
}

