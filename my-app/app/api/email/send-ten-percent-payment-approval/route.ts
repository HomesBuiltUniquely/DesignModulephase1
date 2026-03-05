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
      title: '10% Payment – Approval Confirmation',
      intro:
        'Your 10% milestone payment has been approved. This secures your project slot and allows us to move into the next phase.',
      bulletPoints: [
        'Your payment has been recorded against your project ID.',
        'Design and planning activities will continue as per the agreed timeline.',
        'Your designer or project coordinator will share any next actions, if required.',
      ],
      ctaLabel: 'View Payment Status',
    });

    const info = await sendMail({
      to,
      subject: '10% Payment – Approval Confirmation',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('10% payment approval email error', error);
    return NextResponse.json(
      { error: 'Failed to send 10% payment approval email' },
      { status: 500 }
    );
  }
}

