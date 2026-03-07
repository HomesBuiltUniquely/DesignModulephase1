import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderTenPercentPaymentInternalEmail } from '@/lib/email/render-ten-percent-payment-internal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const ecName = body.ecName as string | undefined;

    if (!to || !customerName || !designerName || !ecName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, designerName, ecName' },
        { status: 400 },
      );
    }

    const { subject, html } = renderTenPercentPaymentInternalEmail({
      customerName,
      designerName,
      ecName,
    });

    const info = await sendMailForPayment({
      to,
      subject,
      html,
      ...(cc && cc.length ? { cc } : {}),
    });

    return NextResponse.json({ success: true, messageId: (info as any).messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('10% payment internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send 10% payment internal email' },
      { status: 500 },
    );
  }
}

