import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface SalesClosurePaymentRejectedEmailProps {
  projectId?: string;
  salesPersonName?: string;
  customerName?: string;
  leadId?: string | number;
}

export default function SalesClosurePaymentRejectedEmail({
  projectId = 'HI-2025-0000',
  salesPersonName = 'Team',
  customerName = 'Customer',
  leadId = '—',
}: SalesClosurePaymentRejectedEmailProps) {
  const submissionDetails: DetailItem[] = [
    { label: 'Lead ID', value: String(leadId) },
    { label: 'Customer Name', value: customerName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="ALERT" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {salesPersonName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Sales Closure Payment Rejected
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          The payment screenshot you submitted for the sales closure has been reviewed and <strong className="text-error">rejected</strong> by the Finance team.
        </Text>

        <DetailsList title="SUBMISSION DETAILS" items={submissionDetails} />

        <Section className="bg-error-light border border-error-border rounded-lg p-4 my-6">
          <Text className="m-0 text-[14px] font-bold text-error mb-2">Next Steps:</Text>
          <Text className="m-0 text-[13px] leading-relaxed text-error">
            Please reach out to the Finance team for clarification, or re-upload the correct payment screenshot via the Sales Closure form using the same Lead ID. Your submission will be reviewed again by Finance.
          </Text>
        </Section>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Note: In the Sales Closure form, please search using the given <strong>Lead ID (#{leadId})</strong> to fetch and re-submit your data.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">Finance Team, HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
