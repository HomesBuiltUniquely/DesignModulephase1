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
      title: 'Design Sign‑off – 40% Payment Approved',
      intro:
        'Your 40% payment at design sign‑off has been approved. This confirms your commitment to proceed into production and execution.',
      bulletPoints: [
        'Final design pack and BOQ are now locked for production.',
        'Procurement and factory planning can begin as per schedule.',
        'Your project manager will share production and site timelines.',
      ],
      ctaLabel: 'View Design Sign‑off Details',
    });

    const info = await sendMail({
      to,
      subject: 'Design Sign‑off – 40% Payment Approved',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Design sign‑off 40% payment approval email error', error);
    return NextResponse.json(
      { error: 'Failed to send design sign‑off 40% payment approval email' },
      { status: 500 }
    );
  }
}

