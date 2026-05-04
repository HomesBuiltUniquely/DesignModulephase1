import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { renderSalesClosurePaymentRejectedEmail } from '@/lib/email/render-sales-closure-payment-rejected';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const salesPersonName = body.salesPersonName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const leadId = body.leadId as string | number | undefined;

    if (!to || !customerName || !leadId) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, leadId' },
        { status: 400 }
      );
    }

    const html = renderSalesClosurePaymentRejectedEmail({
      salesPersonName,
      customerName: String(customerName),
      leadId,
    });

    const info = await sendMailForPayment({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || `Action Required: Sales Closure Payment Rejected – Lead #${leadId}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Sales closure rejection email error', error);
    return NextResponse.json(
      { error: 'Failed to send sales closure rejection email' },
      { status: 500 }
    );
  }
}
