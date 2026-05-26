import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { FileList } from '../../component/blocks/FileList';

export interface DQC2FinalDesignSubmissionInternalEmailProps {
  projectId?: string;
  dqcRepName?: string;
  customerName?: string;
  ecName?: string;
  designerName?: string;
  projectValue?: string;
  attachments?: any[];
}

export default function DQC2FinalDesignSubmissionInternalEmail({
  projectId = 'HI-2025-0000',
  dqcRepName = 'DQC Team',
  customerName = 'Customer',
  ecName = 'Experience Center',
  designerName = 'Designer',
  projectValue = '',
  attachments = [],
}: DQC2FinalDesignSubmissionInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Experience Center', value: ecName },
    { label: 'Designer', value: designerName },
    ...(projectValue ? [{ label: 'Final Project Value', value: `₹ ${projectValue}` }] : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="DQC 2 REVIEW" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {dqcRepName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          DQC 2 Review Request
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          The project is now ready for DQC 2 review following completion of color selection and final design updates.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Kindly review the attached documents to ensure all standards are met.
        </Text>

        {/* Project Details */}
        <DetailsList title="REVIEW DETAILS" items={details} />

        {/* Files List */}
        {attachments && attachments.length > 0 && (
          <FileList 
            title="SUBMITTED FILES FOR REVIEW" 
            files={attachments.map(a => ({ name: a.filename || a.name || 'Submission File', meta: 'DQC 2 Attachment' }))} 
          />
        )}

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please coordinate and share your approval/comments in ERP. A calendar block has been scheduled as per your availability.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
