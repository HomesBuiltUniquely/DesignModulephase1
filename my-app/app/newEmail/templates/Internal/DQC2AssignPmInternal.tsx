import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';

export interface DQC2AssignPmInternalEmailProps {
  projectId?: string;
}

export default function DQC2AssignPmInternalEmail({
  projectId = 'HI-2025-0000',
}: DQC2AssignPmInternalEmailProps) {
  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="ACTION REQUIRED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Internal Notification,</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Assign Project Manager (DQC2)
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          The project has reached the DQC2 stage.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Please assign a Project Manager to oversee the execution and completion of this project.
        </Text>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please review the details in the system.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
