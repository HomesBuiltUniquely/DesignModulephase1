import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface DQC2AssignPmInternalEmailProps {
  projectId?: string;
  customerName?: string;
  projectName?: string;
  designerName?: string;
  branchLocation?: string;
}

export default function DQC2AssignPmInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  projectName = '[Project Name]',
  designerName = 'Designer',
  branchLocation = 'Experience Center',
}: DQC2AssignPmInternalEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Project Name', value: projectName },
    { label: 'Client Name', value: customerName },
    { label: 'Branch', value: branchLocation },
    { label: 'Designer', value: designerName },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="ACTION REQUIRED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear Team,</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Assign Project Manager (DQC2)
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          The <strong>10% Payment</strong> has been approved for <strong>{customerName}</strong>. The project is now ready to move to the next phase.
        </Text>
        <Text className="m-0 text-[15px] font-bold text-error pb-4">
          ⚠️ Please assign a Project Manager for this project immediately.
        </Text>

        <DetailsList title="PROJECT DETAILS" items={snapshotItems} />

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please log into the system to assign the execution personnel.
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
