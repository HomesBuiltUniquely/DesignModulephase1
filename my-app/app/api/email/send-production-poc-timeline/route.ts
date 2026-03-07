import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderProductionPocTimelineEmail } from '@/lib/email/render-production-poc-timeline';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const customerName = body.customerName as string | undefined;
    const productionPoc = body.productionPoc as string | undefined;
    const executionPoc = body.executionPoc as string | undefined;
    const spmPoc = body.spmPoc as string | undefined;
    const operationManager = body.operationManager as string | undefined;
    const operationHead = body.operationHead as string | undefined;
    const designerName = body.designerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderProductionPocTimelineEmail({
      customerName,
      productionPoc,
      executionPoc,
      spmPoc,
      operationManager,
      operationHead,
      designerName,
    });

    const info = await sendMail({
      to,
      subject: 'Production Initiated – Project Timeline Activated',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Production & POC timeline email error', error);
    return NextResponse.json(
      { error: 'Failed to send production & POC timeline email' },
      { status: 500 }
    );
  }
}

