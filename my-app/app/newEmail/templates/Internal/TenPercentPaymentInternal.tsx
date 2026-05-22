import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface TenPercentPaymentInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  ecName?: string;
}

export default function TenPercentPaymentInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  ecName = 'Experience Center',
}: TenPercentPaymentInternalEmailProps) {
  const projectDetails: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Project Name', value: customerName },
    { label: 'Designer Name', value: designerName },
    { label: 'Experience Center', value: ecName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="10% PAYMENT DUE" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {designerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          DQC 1 Approved – Proceed with 10% Collection
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          DQC 1 for the project listed below has been successfully approved.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please proceed with the 10% milestone collection from the customer. Once payment is confirmed, raise the D2 – Site Masking request in ERP and schedule the activity.
        </Text>

        {/* Project Details */}
        <DetailsList title="PROJECT DETAILS" items={projectDetails} />

        <Text className="m-0 text-[15px] leading-relaxed text-red-600 font-semibold pb-8 mt-4">
          Kindly ensure there is no delay between payment confirmation and masking initiation.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
