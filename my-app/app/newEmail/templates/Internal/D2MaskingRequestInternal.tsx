import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface D2MaskingRequestInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  ecName?: string;
  mmtName?: string | null;
  pmName?: string | null;
}

export default function D2MaskingRequestInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  ecName = 'Experience Center',
  mmtName = '',
  pmName = '',
}: D2MaskingRequestInternalEmailProps) {
  const greeting = mmtName && pmName
    ? `Dear ${mmtName} & ${pmName},`
    : mmtName
      ? `Dear ${mmtName} & PM Team,`
      : pmName
        ? `Dear MMT Team & ${pmName},`
        : "Dear MMT & PM Team,";

  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Experience Center', value: ecName },
    { label: 'Designer', value: designerName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="MASKING REQUEST" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">{greeting}</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          D2 Site Masking Request
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          DQC 1 has been approved and 10% payment is confirmed for the below project.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Kindly proceed with scheduling the D2 – Site Masking activity. All updated design files are available in ERP for reference.
        </Text>

        {/* Project Details */}
        <DetailsList title="PROJECT DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please coordinate and confirm the scheduled date with the client.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - ERP Notification</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
