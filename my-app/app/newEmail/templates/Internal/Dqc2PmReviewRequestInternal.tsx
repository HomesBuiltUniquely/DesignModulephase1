import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface DQC2PmReviewRequestInternalEmailProps {
  projectId?: string;
  pmName?: string;
  customerName?: string;
  designerName?: string;
  ecName?: string;
}

export default function DQC2PmReviewRequestInternalEmail({
  projectId = 'HI-2025-0000',
  pmName = 'Project Manager',
  customerName = 'Customer',
  designerName = 'Designer',
  ecName = 'Experience Center',
}: DQC2PmReviewRequestInternalEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Designer', value: designerName },
    { label: 'Experience Center', value: ecName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="DQC 2 APPROVED - PM REVIEW" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {pmName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Action Required: Project Review & Approval
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          DQC 2 review has been **Approved** by the DQC team for project <strong>{customerName}</strong>. 
          As the assigned Project Manager, please review the finalized design drawings, specifications, and quotation in Design CRM, and submit your formal project approval to proceed with the Design Sign-off and 40% milestone.
        </Text>

        <DetailsList title="PROJECT SNAPSHOT" items={snapshotItems} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-6">
          Please complete your review and submit your approval in the Design CRM dashboard.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior - ERP Notification</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
