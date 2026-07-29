import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import React from 'react';
import { sendMail } from '@/lib/email/mailer';
import MailLoopChainInitiateEmail from '@/app/newEmail/templates/External/MailLoopChainInitiate';

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function salesFormSources(leadPayload: Record<string, unknown> | undefined) {
  const pd = leadPayload ?? {};
  const formData = (pd.formData as Record<string, unknown> | undefined) ?? {};
  const fData = (pd.fetchedData as Record<string, unknown> | undefined) ?? {};
  const pick = (key: string) => pickString(pd[key], formData[key], fData[key]);
  const pickNum = (key: string) =>
    pickNumber(pd[key], formData[key], fData[key]);
  return { pd, pick, pickNum };
}

function buildDiscountFields(pick: (key: string) => string, pickNum: (key: string) => number | null) {
  const wood = pickNum('dis_on_woodwork') ?? 0;
  const service = pickNum('dis_on_service') ?? 0;
  const accessories = pickNum('dis_on_accessories') ?? 0;
  const parts: string[] = [];
  if (wood > 0) parts.push(`${wood}% off woodwork`);
  if (service > 0) parts.push(`${service}% off service`);
  if (accessories > 0) parts.push(`${accessories}% off accessories`);
  const hasDiscount = parts.length > 0;

  return {
    discountLabel: hasDiscount ? 'Discount' : 'Woodwork discount',
    discountValue: hasDiscount ? parts.join(' · ') : 'N/A',
    discountSubtitle: hasDiscount
      ? 'As agreed during your sales consultation'
      : 'Applied to full woodwork scope',
  };
}

export function mapLeadPayloadToEmailProps(
  customerName: string,
  leadPayload: Record<string, unknown> | undefined,
) {
  const { pd, pick, pickNum } = salesFormSources(leadPayload);
  const { discountLabel, discountValue, discountSubtitle } = buildDiscountFields(pick, pickNum);

  const clientFullName = pick('customer_name') || customerName;
  const dateOfCall = pick('booking_date') || '[Date]';
  const addressCity = pick('site_address') || '[Address, City]';
  const projectType = pick('booking_type') || '[New Home / Renovation]';
  const propertyConfiguration = pick('property_configuration');
  const propertyName = pick('property_name');
  const possession = pick('possession');
  const leadSource = pick('lead_source');
  const salesLeadName = pick('sales_lead_name');

  const orderValue = pickNum('order_value');
  const totalAmount =
    orderValue != null ? orderValue.toLocaleString('en-IN') : '[Total Amount]';

  const salesConsultantName = pick('sales_spoc') || '[Name]';
  const branch = pick('experience_center') || '[Branch]';
  const salesConsultantInfo = `${salesConsultantName} · ${branch}`;

  const scopeFrozen = pick('scope_frozen');
  const scopeOfWork =
    propertyConfiguration ||
    (scopeFrozen ? `Scope frozen: ${scopeFrozen}` : '') ||
    'Woodwork · Kitchen · Flooring · Civil';

  const bookingReceived = pick('payment_received') || 'Pending';
  const amountPaid = pickNum('amount_paid');
  const timelinePromise = pick('timeline_promise_by_sales');
  const specialOffer = pick('special_offer');
  const customCommitments = pick('custom_commitments');

  const projectId =
    pick('project_id') ||
    pick('projectId') ||
    pick('reference_id') ||
    (pd.pid != null ? String(pd.pid) : '') ||
    'HI-2025-0000';

  return {
    customerName,
    projectId,
    clientFullName,
    dateOfCall,
    addressCity,
    projectType,
    propertyName,
    propertyConfiguration,
    possession,
    leadSource,
    salesLeadName,
    scopeOfWork,
    totalAmount,
    salesConsultantInfo,
    discountLabel,
    discountValue,
    discountSubtitle,
    bookingReceived,
    amountPaid: amountPaid != null ? amountPaid.toLocaleString('en-IN') : '',
    timelinePromise,
    specialOffer,
    customCommitments,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | string[] | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const leadPayload = body.leadPayload as Record<string, unknown> | undefined;

    const toList = Array.isArray(to)
      ? to.map((e) => String(e || '').trim()).filter(Boolean)
      : to
        ? [String(to).trim()].filter(Boolean)
        : [];

    if (toList.length === 0 || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const emailProps = mapLeadPayloadToEmailProps(customerName, leadPayload);
    const emailComponent = React.createElement(MailLoopChainInitiateEmail, emailProps);
    const html = await render(emailComponent);

    const info = await sendMail({
      to: toList.length === 1 ? toList[0] : toList,
      ...(cc ? { cc } : {}),
      subject: subject || 'Welcome to HUB Interior',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Mail loop chain initiate send error', error);
    return NextResponse.json(
      { error: 'Failed to send mail loop chain initiate email' },
      { status: 500 },
    );
  }
}
