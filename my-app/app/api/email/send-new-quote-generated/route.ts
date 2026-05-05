import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderNewQuoteGeneratedEmail } from '@/lib/email/render-new-quote-generated';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const salesPersonName = body.salesPersonName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const leadId = body.leadId as string | number | undefined;
    const quoteId = body.quoteId as string | number | undefined;

    if (!to || !customerName || !leadId || !quoteId) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, leadId, quoteId' },
        { status: 400 }
      );
    }

    const html = renderNewQuoteGeneratedEmail({
      salesPersonName,
      customerName: String(customerName),
      leadId,
      quoteId,
    });

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || `New Quote Generated – Lead #${leadId}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('New quote generated email error', error);
    return NextResponse.json(
      { error: 'Failed to send new quote generated email' },
      { status: 500 }
    );
  }
}
