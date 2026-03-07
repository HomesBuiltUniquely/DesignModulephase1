import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderD2MaskingRequestInternalEmail } from '@/lib/email/render-d2-masking-request-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const ecName = body.ecName as string | undefined;
    const maskingDate = body.maskingDate as string | null | undefined;
    const maskingTime = body.maskingTime as string | null | undefined;
    const mmtName = body.mmtName as string | undefined;
    const pmName = body.pmName as string | undefined;

    if (!to || !customerName || !designerName || !ecName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, designerName, ecName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderD2MaskingRequestInternalEmail({
      customerName,
      designerName,
      ecName,
      mmtName,
      pmName,
      maskingDate,
      maskingTime,
    });

    const info = await sendMail({
      to,
      subject,
      html,
      ...(cc && cc.length ? { cc } : {}),
    } as any);

    return NextResponse.json({ success: true, messageId: (info as any).messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D2 masking request internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send D2 masking request internal email' },
      { status: 500 },
    );
  }
}
