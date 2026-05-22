import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface D2MaskingRequestEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  maskingDate?: string | null;
  maskingTime?: string | null;
}

export default function D2MaskingRequestEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  maskingDate = '–',
  maskingTime = '–',
}: D2MaskingRequestEmailProps) {
  // Format maskingTime if it is HH:MM
  let timeDisplay = maskingTime || '–';
  if (maskingTime && maskingTime.includes(':')) {
    const [h, m] = maskingTime.split(':');
    const hours = parseInt(h, 10);
    if (!isNaN(hours)) {
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const hour12 = ((hours % 12) || 12).toString().padStart(2, '0');
      timeDisplay = `${hour12}:${m} ${suffix}`;
    }
  }

  const details: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Scheduled Date', value: maskingDate || '–' },
    { label: 'Scheduled Time', value: timeDisplay },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="D2 · SITE MASKING" status="SCHEDULED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          D2 - Site Masking Scheduled
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          We are pleased to inform you that your **D2 - Site Masking** visit has been scheduled. As your 10% milestone is complete, our project management team will visit your site to execute the detailed physical masking process, ensuring precise technical alignments before we proceed with the backend engineering work.
        </Text>

        {/* Schedule Details */}
        <DetailsList title="D2 SITE MASKING SCHEDULE" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Kindly ensure site access is available for the team at the scheduled time. Please inform us in advance if there are any specific gate/entry instructions. We're progressing smoothly to the next phase!
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
