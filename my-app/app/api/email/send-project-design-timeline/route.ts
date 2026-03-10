import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderProjectDesignTimelineEmail } from '@/lib/email/render-project-design-timeline';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const attachments = body.attachments as Array<{ filename: string; content: string; encoding?: 'base64' }> | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderProjectDesignTimelineEmail({ customerName });

    const info = await sendMail({
      to,
      subject: 'Your Project Design Timeline – HUB Interior',
      html,
      attachments: attachments?.length ? attachments : undefined,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Project design timeline email send error', error);
    return NextResponse.json(
      { error: 'Failed to send project design timeline email' },
      { status: 500 }
    );
  }
}

