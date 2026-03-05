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
      title: 'DQC2 – Material Selection Session Scheduled',
      intro:
        'Your DQC2 material selection session has been scheduled. In this meeting, we will finalise materials, finishes and key touchpoints for your home.',
      bulletPoints: [
        'Review shortlisted laminates, fabrics, finishes and fixtures.',
        'Understand maintenance, durability and budget implications.',
        'Lock selections that will move into final drawings and BOQ.',
      ],
      ctaLabel: 'View Session Details',
    });

    const info = await sendMail({
      to,
      subject: 'DQC2 – Material Selection Session Scheduled',
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

