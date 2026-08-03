import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import React from 'react';
import { sendMail } from '@/lib/email/mailer';
import MailLoopChainInitiateEmail, { EmailConfigScope, EmailConfigScopeRoom } from '@/app/newEmail/templates/External/MailLoopChainInitiate';

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
  quotationTotal?: string,
  quotationLink?: string,
) {
  const { pd, pick, pickNum } = salesFormSources(leadPayload);
  const { discountLabel, discountValue, discountSubtitle } = buildDiscountFields(pick, pickNum);

  // Extract configScopeSummary merged by the caller (from project.configScopeSummary or fallback payload locations)
  const rawScopeObj =
    pd.configScopeSummary ||
    pd.configurationScope ||
    (pd.connection as Record<string, unknown> | undefined)?.configurationScope ||
    (pd.formData as Record<string, unknown> | undefined)?.configScopeSummary ||
    (pd.formData as Record<string, unknown> | undefined)?.configurationScope ||
    (pd.fetchedData as Record<string, unknown> | undefined)?.configScopeSummary ||
    (pd.fetchedData as Record<string, unknown> | undefined)?.configurationScope ||
    pd.config_scope_summary ||
    pd.config_scope;
  const scope = (rawScopeObj as Record<string, unknown> | null | undefined) ?? null;
  const scopeRooms = Array.isArray((scope as any)?.selectedRooms) ? (scope as any).selectedRooms as Array<any> : [];
  const scopeRoomNames: string[] = Array.isArray((scope as any)?.selectedRoomNames)
    ? ((scope as any).selectedRoomNames as string[])
    : scopeRooms.map((r) => r.roomName).filter(Boolean) as string[];

  let configScope: EmailConfigScope | null = null;
  if (scope && typeof scope === 'object') {
    const s = scope as Record<string, any>;
    const rawRooms = Array.isArray(s.selectedRooms) ? s.selectedRooms : [];
    const parsedRooms: EmailConfigScopeRoom[] = rawRooms.map((r: any) => {
      let unitsStr = '';
      if (Array.isArray(r.unitsRequired) && r.unitsRequired.length > 0) {
        unitsStr = r.unitsRequired.filter(Boolean).join(', ');
      } else if (Array.isArray(r.units) && r.units.length > 0) {
        unitsStr = r.units
          .filter((u: any) => u.selected && u.label)
          .map((u: any) => u.label)
          .join(', ');
      } else if (typeof r.unitsRequired === 'string') {
        unitsStr = r.unitsRequired;
      } else if (typeof r.units === 'string') {
        unitsStr = r.units;
      }
      return {
        roomName: String(r.roomName || ''),
        units: unitsStr,
        falseCeiling: Boolean(r.falseCeilingRequired || r.falseCeiling),
        notes: r.notes != null ? String(r.notes) : '',
      };
    });

    configScope = {
      expectedTimeline: s.expectedTimeline != null ? String(s.expectedTimeline) : undefined,
      kitchenLayout: s.kitchenLayout != null ? String(s.kitchenLayout) : undefined,
      materialFinish: s.materialFinish != null ? String(s.materialFinish) : undefined,
      wfhSetup: typeof s.wfhSetup === 'boolean' ? s.wfhSetup : undefined,
      petFriendly: typeof s.petFriendly === 'boolean' ? s.petFriendly : undefined,
      familySizeDetails:
        s.familySizeDetails != null
          ? String(s.familySizeDetails)
          : s.projectUnderstanding != null
          ? String(s.projectUnderstanding)
          : undefined,
      familyContactName: s.familyContactName != null ? String(s.familyContactName) : undefined,
      familyContactPhone: s.familyContactPhone != null ? String(s.familyContactPhone) : undefined,
      rooms: parsedRooms,
    };
  }

  const clientFullName = pick('customer_name') || customerName;
  // Property address: injected property_location first, then raw payload, fallback N/A
  const addressCity =
    pick('property_location') || pick('intake_property_location') || pick('site_address') || 'N/A';
  const projectType = pick('booking_type') || pick('intake_booking_type') || '[New Home / Renovation]';
  // Configuration: check injected intake field first
  const propertyConfiguration =
    pick('intake_configuration') || pick('property_configuration');
  const propertyName = pick('property_name') || (scope as any)?.propertyName || '';
  // Possession: check injected intake field too
  const possession =
    pick('possession') || pick('intake_possession_date') || pick('possession_date') || '';
  const leadSource = pick('lead_source') || '';
  const salesLeadName = pick('sales_lead_name') || '';

  // Project value: quotation total (if passed, means quote exists) → else budget from View modal
  const budgetRaw = pick('budget') || pick('intake_budget');
  const totalAmount = quotationTotal || budgetRaw || 'N/A';

  // Sales consultant: injected sales_executive field first, then raw payload keys
  const salesConsultantName =
    pick('sales_executive') || pick('intake_sales_executive') || pick('sales_spoc') || '[Name]';
  const branch = pick('experience_center') || '[Branch]';
  const salesConsultantInfo = `${salesConsultantName} · ${branch}`;

  // scopeOfWork: strictly fetch details from "Config scope — basic" (same source as View modal)
  const scopeItems: string[] = [];
  if (scopeRoomNames.length > 0) scopeItems.push(scopeRoomNames.join(', '));
  if ((scope as any)?.kitchenLayout) scopeItems.push(`Kitchen: ${(scope as any).kitchenLayout}`);
  if ((scope as any)?.materialFinish) scopeItems.push(`Finish: ${(scope as any).materialFinish}`);
  if ((scope as any)?.expectedTimeline) scopeItems.push(`Timeline: ${(scope as any).expectedTimeline}`);
  if ((scope as any)?.wfhSetup !== undefined) scopeItems.push(`WFH: ${(scope as any).wfhSetup ? 'Yes' : 'No'}`);
  if ((scope as any)?.petFriendly !== undefined) scopeItems.push(`Pet Friendly: ${(scope as any).petFriendly ? 'Yes' : 'No'}`);
  if (Array.isArray((scope as any)?.miscAddOns) && (scope as any).miscAddOns.length > 0) {
    scopeItems.push(`Add-ons: ${(scope as any).miscAddOns.join(', ')}`);
  }

  const scopeOfWork =
    scopeItems.length > 0
      ? scopeItems.join(' · ')
      : pick('scope_of_work') || pick('scopeOfWork') || 'Config scope — basic details pending in MeetingWiz';

  const formData = (pd.formData as Record<string, unknown> | undefined) ?? {};
  const fData = (pd.fetchedData as Record<string, unknown> | undefined) ?? {};

  // Finance approval detection — check all known field names from CRM
  // financeApprovedRaw: stored as string "true"/"false" on the project level
  const financeApprovedRawStr = pickString(pd.finance_approved_raw);
  const isApprovedByRaw =
    financeApprovedRawStr !== '' && financeApprovedRawStr !== 'false';
  const financeApprovedAt =
    pick('approved_at') ||
    pick('finance_approved_at') ||
    pick('sales_closure_finance_approved_at') ||
    pick('crm_booking_finance_approved_at');
  const financeApproved =
    isApprovedByRaw ||
    Boolean(
      pd.sales_closure_finance_approved ||
        formData.sales_closure_finance_approved ||
        fData.sales_closure_finance_approved ||
        pd.crm_booking_finance_approved ||
        formData.crm_booking_finance_approved ||
        fData.crm_booking_finance_approved ||
        financeApprovedAt,
    );

  // Booking received: "Done" with approval date, else "Pending" with booking date
  let bookingReceived: string;
  let dateOfCall: string;

  if (financeApproved) {
    bookingReceived = 'Done';
    const rawDate = financeApprovedAt || pick('booking_date') || '';
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        dateOfCall = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : rawDate.split('T')[0];
      } catch {
        dateOfCall = rawDate;
      }
    } else {
      dateOfCall = 'Finance approved';
    }
  } else {
    bookingReceived = pick('payment_received') || 'Pending';
    const rawBookingDate = pick('booking_date') || '';
    if (rawBookingDate) {
      try {
        const d = new Date(rawBookingDate);
        dateOfCall = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : rawBookingDate.split('T')[0];
      } catch {
        dateOfCall = rawBookingDate;
      }
    } else {
      dateOfCall = '[Date]';
    }
  }

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
    quotationLink: (() => {
      let qLink = quotationLink?.trim() || pick('quotation_link') || pick('quote_link') || '';
      if (!qLink) {
        const qid = pick('prolance_quote_id') || pick('prolanceQuoteId') || pick('quotation_id') || pick('quote_id');
        if (qid && Number(qid) > 0) {
          qLink = `https://homesbuiltuniquely.com/quote/${Math.trunc(Number(qid))}`;
        }
      }
      return qLink;
    })(),
    configScope,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | string[] | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const quotationTotal = body.quotationTotal as string | undefined;
    const quotationLink = body.quotationLink as string | undefined;
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

    const emailProps = mapLeadPayloadToEmailProps(customerName, leadPayload, quotationTotal, quotationLink);
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
