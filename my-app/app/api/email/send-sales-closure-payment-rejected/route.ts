import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import SalesClosurePaymentRejectedEmail from '@/app/newEmail/templates/Internal/SalesClosurePaymentRejected';
import React from 'react';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const salesPersonName = body.salesPersonName as string | undefined;
    const customerName = body.customerName as string | undefined;
    const leadId = body.leadId as string | number | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !leadId) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, leadId' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(SalesClosurePaymentRejectedEmail, {
      projectId,
      salesPersonName,
      customerName: String(customerName),
      leadId,
    });

    const html = await render(emailComponent);

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
