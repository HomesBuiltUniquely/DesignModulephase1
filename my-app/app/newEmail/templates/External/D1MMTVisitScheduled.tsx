import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface D1MMTVisitScheduledEmailProps {
  customerName?: string;
  projectId?: string;
  visitDate?: string;
  visitTime?: string;
  executiveName?: string;
  executivePhone?: string;
  designerName?: string;
}

export default function D1MMTVisitScheduledEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  visitDate = 'October 24, 2025',
  visitTime = '10:00 AM',
  executiveName = '[Executive Name]',
  executivePhone = '[Executive Phone]',
  designerName = 'Your Design Consultant',
}: D1MMTVisitScheduledEmailProps) {
  const visitDetails: DetailItem[] = [
    { label: 'Date', value: visitDate },
    { label: 'Time', value: visitTime },
    { label: 'Measurement Executive', value: `${executiveName} (${executivePhone})` },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="D1 · SITE AUDIT" status="VISIT SCHEDULED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Site Measurement Visit Scheduled
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Hi {customerName}, your upcoming site audit for the interior project has been confirmed. Please find the visit details below.
        </Text>

        {/* Details Card */}
        <DetailsList title="VISIT DETAILS" items={visitDetails} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Please Note:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Ensure site access and keys are ready at the scheduled time.</li>
          <li className="mb-1">Electricity availability is required for high‑precision laser measurements.</li>
          <li className="mb-1">Arrange society gate permissions or visitor passes prior to the visit.</li>
        </ul>

        {/* Reschedule Button */}
        <div className="text-center mt-6 mb-6">
          <Button text="SHARE ACCESS INSTRUCTIONS" href="#" />
        </div>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          I hope this schedule works for you. In case of any constraints, please feel free to let me know. Looking forward to our continued collaboration.
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
