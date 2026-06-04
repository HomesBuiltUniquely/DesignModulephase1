import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email/mailer';
import { render } from '@react-email/components';
import D1SiteMeasurementEmail from '@/app/newEmail/templates/External/D1SiteMeasurement';
import React from 'react';

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function mapLeadPayloadRmFields(
  leadPayload: Record<string, unknown> | undefined,
  designerName?: string,
) {
  const pd = leadPayload ?? {};
  const fData = (pd.fetchedData as Record<string, unknown> | undefined) ?? pd;
  const formData = (pd.formData as Record<string, unknown> | undefined) ?? pd;

  const rmName = pickString(
    fData.relationship_manager_name,
    fData.relationship_manager,
    formData.relationship_manager_name,
    formData.relationship_manager,
    fData.sales_spoc,
    formData.sales_spoc,
    designerName,
  );
  const rmPhone = pickString(
    fData.relationship_manager_phone,
    formData.relationship_manager_phone,
    fData.co_no,
    formData.co_no,
    pd.contact_no,
  );
  const rmEmail = pickString(
    fData.relationship_manager_email,
    formData.relationship_manager_email,
    fData.sales_spoc_email,
    formData.sales_spoc_email,
    fData.sales_email,
    formData.sales_email,
    fData.email,
    formData.email,
    pd.designer_email,
  );

  return { rmName, rmPhone, rmEmail };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = body.to as string | undefined;
    const cc = body.cc as string[] | string | undefined;
    const subject = body.subject as string | undefined;
    const customerName = body.customerName as string | undefined;
    const projectId = body.projectId;
    const propertyType = body.propertyType;
    const designerName = body.designerName as string | undefined;
    const acknowledgeHref = body.acknowledgeHref as string | undefined;
    const leadPayload = body.leadPayload as Record<string, unknown> | undefined;
    const salesTerms = body.salesTerms as
      | { term: string; detail: string }[]
      | undefined;

    if (!to || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: to, customerName' },
        { status: 400 },
      );
    }

    const { rmName, rmPhone, rmEmail } = mapLeadPayloadRmFields(leadPayload, designerName);

    const emailComponent = React.createElement(D1SiteMeasurementEmail, {
      customerName,
      projectId: projectId ? String(projectId) : undefined,
      propertyType,
      designerName: designerName || 'Your Design Consultant',
      salesTerms,
      rmName,
      rmPhone,
      rmEmail,
      acknowledgeHref: acknowledgeHref || '#',
    });

    const html = await render(emailComponent);

    const info = await sendMail({
      to,
      ...(cc ? { cc } : {}),
      subject: subject || 'Welcome to HUB Interior – D1 Site Measurement',
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('D1 email send error', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 },
    );
  }
}
