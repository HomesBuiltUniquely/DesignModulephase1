import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface DQC2ApprovalInternalEmailProps {
  projectId?: string;
  designerName?: string;
  customerName?: string;
}

export default function DQC2ApprovalInternalEmail({
  projectId = 'HI-2025-0000',
  designerName = 'Designer',
  customerName = 'Customer',
}: DQC2ApprovalInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="DQC 2 CLEARED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {designerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Action Required – DQC 2 Cleared
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          DQC 2 has been approved and the Project Manager has approved the project for <strong>{customerName}</strong>.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please initiate the Design Sign-Off discussion immediately and ensure full documentation before proceeding to the 40% milestone.
        </Text>

        {/* Project details */}
        <DetailsList title="PROJECT DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-red-600 font-semibold pb-8 mt-4">
          No scope deviations should be entertained post sign-off.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior - ERP Notification</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
