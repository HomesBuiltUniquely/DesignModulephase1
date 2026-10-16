import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import PaymentReceivedInternalEmail from '@/app/newEmail/templates/Internal/PaymentReceivedInternal';
import React from 'react';

function withInr(value: string | undefined): string {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (s.startsWith('₹')) return s;
  const n = Number(s.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return s;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const designerName = body.designerName as string | undefined;
    const projectId = body.projectId as string | undefined;
    const milestoneLabel = body.milestoneLabel as string | undefined;
    const amountPaid = body.amountPaid as string | undefined;
    const amountAchieved = body.amountAchieved as string | undefined;
    const milestoneTarget = body.milestoneTarget as string | undefined;
    const remainingMilestone = body.remainingMilestone as string | undefined;
    const paymentMode = body.paymentMode as string | undefined;
    const paymentDate = body.paymentDate as string | undefined;
    const isPartial = Boolean(body.isPartial);

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailComponent = React.createElement(PaymentReceivedInternalEmail, {
      projectId,
      customerName,
      designerName: designerName || 'Designer',
      milestoneLabel: milestoneLabel || 'Design payment',
      amountPaid: withInr(amountPaid),
      amountAchieved: withInr(amountAchieved),
      milestoneTarget: withInr(milestoneTarget),
      remainingMilestone: withInr(remainingMilestone),
      paymentMode: paymentMode || 'Easebuzz (Online)',
      paymentDate,
      isPartial,
    });

    const html = await render(emailComponent);
    const ms = milestoneLabel || 'Design payment';

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject:
        subject ||
        (isPartial
          ? `Partial payment received — ${ms} — ${projectId || ''}`
          : `Payment received — ${ms} — ${projectId || ''}`),
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('payment-received-internal email error', error);
    return NextResponse.json(
      { error: 'Failed to send payment-received-internal email' },
      { status: 500 },
    );
  }
}
