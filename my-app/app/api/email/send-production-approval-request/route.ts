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
      title: 'Production Approval Request',
      intro:
        'We are ready to move your project into production. Please review the shared documents and confirm approval so we can proceed.',
      bulletPoints: [
        'Review the final design pack, BOQ and commercial terms.',
        'Confirm that material selections and finishes are as discussed.',
        'Post‑approval, we will initiate procurement and factory processing.',
      ],
      ctaLabel: 'Approve for Production',
    });

    const info = await sendMail({
      to,
      subject: 'Production Approval Request – HUB Interior',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Production approval request email error', error);
    return NextResponse.json(
      { error: 'Failed to send production approval request email' },
      { status: 500 }
    );
  }
}

