import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import {
  renderMomColorLaminateSelectionConfirmationEmail,
  type LaminateSelections,
} from '@/lib/email/render-mom-color-laminate-selection-confirmation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subjectOverride = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const laminateSelections = body.laminateSelections as LaminateSelections | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 }
      );
    }

    const { subject, html } = renderMomColorLaminateSelectionConfirmationEmail({
      customerName,
      designerName,
      laminateSelections: laminateSelections ?? undefined,
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
    console.error('MOM color laminate selection confirmation email error', error);
    return NextResponse.json(
      { error: 'Failed to send MOM color laminate selection confirmation email' },
      { status: 500 }
    );
  }
}
