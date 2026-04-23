import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { renderProductionApprovalRequestEmail } from '@/lib/email/render-production-approval-request';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const html = renderProductionApprovalRequestEmail({
      customerName,
      designerName,
    });

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Final Approval Required – Production Initiation',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Production approval request email error', error);
    return NextResponse.json(
      { error: 'Failed to send production approval request email' },
      { status: 500 }
    );
  }
}

