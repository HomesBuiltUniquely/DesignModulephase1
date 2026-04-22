import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderD2MaskingRequestEmail } from '@/lib/email/render-d2-masking-request';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const maskingDate = body.maskingDate as string | null | undefined;
    const maskingTime = body.maskingTime as string | null | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const { subject, html } = renderD2MaskingRequestEmail({
      customerName,
      designerName,
      maskingDate,
      maskingTime,
    });

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subjectOverride || subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D2 masking request email error', error);
    return NextResponse.json(
      { error: 'Failed to send D2 masking request email' },
      { status: 500 }
    );
  }
}

