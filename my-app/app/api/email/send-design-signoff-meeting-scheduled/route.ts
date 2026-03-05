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
      title: 'Design Sign‑off Meeting Scheduled',
      intro:
        'Your design sign‑off meeting has been scheduled. This is the session where we formalise the final design and move into production.',
      bulletPoints: [
        'We will review the final layouts, finishes and key specifications.',
        'Any last minor clarifications will be addressed before sign‑off.',
        'We will also walk you through payment and production timelines.',
      ],
      ctaLabel: 'View Meeting Details',
    });

    const info = await sendMail({
      to,
      subject: 'Design Sign‑off Meeting Scheduled',
      html,
    });

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

