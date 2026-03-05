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
      title: 'Design Sign‑off – 40% Payment Request',
      intro:
        'As we reach design sign‑off, the 40% milestone payment is now due. This enables us to initiate procurement and production on your project.',
      bulletPoints: [
        'The 40% milestone is linked to final design approval and BOQ lock‑in.',
        'Once payment is received, procurement and factory planning will start.',
        'Your project manager will share a detailed production and installation timeline.',
      ],
      ctaLabel: 'Complete 40% Payment',
    });

    const info = await sendMail({
      to,
      subject: 'Design Sign‑off – 40% Payment Request',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Design sign‑off 40% payment request email error', error);
    return NextResponse.json(
      { error: 'Failed to send design sign‑off 40% payment request email' },
      { status: 500 }
    );
  }
}

