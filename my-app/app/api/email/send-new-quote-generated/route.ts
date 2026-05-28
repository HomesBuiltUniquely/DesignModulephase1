import { NextResponse } from 'next/server';
import { sendMailForPayment } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import NewQuoteGeneratedEmail from '@/app/newEmail/templates/Internal/NewQuoteGenerated';
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
    const quoteId = body.quoteId as string | number | undefined;
    const projectId = body.projectId as string | undefined;

    if (!to || !customerName || !leadId || !quoteId) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName, leadId, quoteId' },
        { status: 400 }
      );
    }

    const emailComponent = React.createElement(NewQuoteGeneratedEmail, {
      projectId,
      salesPersonName,
      customerName: String(customerName),
      leadId,
      quoteId,
    });

    const html = await render(emailComponent);

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
