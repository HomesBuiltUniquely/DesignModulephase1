import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderDqc2FinalDesignSubmissionEmail } from '@/lib/email/render-dqc2-final-design-submission';

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

    const html = renderDqc2FinalDesignSubmissionEmail({ customerName });

    const info = await sendMail({
      to,
      subject: 'DQC2 – Final Design Submission Ready',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('DQC2 final design submission email error', error);
    return NextResponse.json(
      { error: 'Failed to send DQC2 final design submission email' },
      { status: 500 }
    );
  }
}

