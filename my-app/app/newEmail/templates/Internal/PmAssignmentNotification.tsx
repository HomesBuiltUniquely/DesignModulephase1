import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface PmAssignmentNotificationEmailProps {
  projectId?: string;
  pmName?: string;
  customerName?: string;
  projectName?: string;
  designerName?: string;
  branchLocation?: string;
}

export default function PmAssignmentNotificationEmail({
  projectId = 'HI-2025-0000',
  pmName = 'Project Manager',
  customerName = 'Customer',
  projectName = '[Project Name]',
  designerName = 'Designer',
  branchLocation = 'Experience Center',
}: PmAssignmentNotificationEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Project Name', value: projectName },
    { label: 'Client Name', value: customerName },
    { label: 'Branch', value: branchLocation },
    { label: 'Designer', value: designerName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="PM ASSIGNED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {pmName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Project Manager Assigned
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          You have been assigned as the <strong>Project Manager</strong> for the project below. Please review the project details and take the necessary steps to onboard.
        </Text>

        <DetailsList title="PROJECT DETAILS" items={snapshotItems} />

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please review the details in the system and coordinate with the designer.
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
