import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface NewQuoteGeneratedEmailProps {
  projectId?: string;
  salesPersonName?: string;
  customerName?: string;
  leadId?: string | number;
  quoteId?: string | number;
}

export default function NewQuoteGeneratedEmail({
  projectId = 'HI-2025-0000',
  salesPersonName = 'Team',
  customerName = 'Customer',
  leadId = '—',
  quoteId = '—',
}: NewQuoteGeneratedEmailProps) {
  const quoteDetails: DetailItem[] = [
    { label: 'Lead ID', value: String(leadId) },
    { label: 'Customer Name', value: customerName },
    { label: 'Quote ID', value: String(quoteId) },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="QUOTE GENERATED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {salesPersonName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          New Quote Generated
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          A new quote has been generated successfully for your lead. Please find the details below:
        </Text>

        <DetailsList title="QUOTE DETAILS" items={quoteDetails} />

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          You can view the newly generated quote details in the CRM Dashboard.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">Team HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
