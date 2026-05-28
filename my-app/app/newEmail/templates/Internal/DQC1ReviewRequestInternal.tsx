import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface DQC1ReviewRequestInternalEmailProps {
  projectId?: string;
  dqcRepName?: string;
  customerName?: string;
  ecName?: string;
  designerName?: string;
  projectValue?: string;
  drawingFileName?: string;
  quotationFileName?: string;
}

export default function DQC1ReviewRequestInternalEmail({
  projectId = 'HI-2025-0000',
  dqcRepName = 'DQC Team Member',
  customerName = 'Customer',
  ecName = 'Experience Center',
  designerName = 'Designer',
  projectValue,
  drawingFileName,
  quotationFileName,
}: DQC1ReviewRequestInternalEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Experience Center', value: ecName },
    { label: 'Designer', value: designerName },
  ];

  if (projectValue) {
    snapshotItems.push({ label: 'Project Value', value: `₹ ${projectValue}` });
  }

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="REVIEW REQUEST" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {dqcRepName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          DQC1 Review Request
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          The final design files for this project have been uploaded and are ready for <strong>DQC 1 review</strong>.
        </Text>

        <DetailsList title="PROJECT SNAPSHOT" items={snapshotItems} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Files Submitted:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Final Drawing {drawingFileName ? ` – ${drawingFileName}` : ''}</li>
          <li className="mb-1">Final Quotation {quotationFileName ? ` – ${quotationFileName}` : ''}</li>
        </ul>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Kindly review and share your approval or comments at the earliest convenience. A calendar block has been scheduled as per your availability.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Design Team · HUB Interior</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
