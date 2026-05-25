import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface D1SiteMeasurementEmailProps {
  customerName?: string;
  projectId?: string;
  propertyType?: string;
  designerName?: string;
}

export default function D1SiteMeasurementEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  propertyType = '4-Room Apartment',
  designerName = 'Your Design Consultant',
}: D1SiteMeasurementEmailProps) {
  const projectDetails: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Property Type', value: propertyType },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="D1 · SITE AUDIT" status="WELCOME ONBOARD" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Let’s begin your design journey
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Hi {customerName}, we’re thrilled to start this creative process with you. Your dream space is just a few steps away from reality.
        </Text>

        {/* Project details card */}
        <DetailsList title="OFFER CONFIRMED" items={projectDetails} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Here’s what happens next:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1"><span className="font-bold">Confirm Measurement Slot:</span> Select a time for our designer to visit your site.</li>
          <li className="mb-1"><span className="font-bold">Moodboard Presentation:</span> Review initial design directions and material palettes.</li>
          <li className="mb-1"><span className="font-bold">3D Visualization:</span> Experience your home through high-quality renders.</li>
        </ul>

        {/* Reschedule Button */}
        <div className="text-center mt-6 mb-6">
          <Button text="CONFIRM MEASUREMENT SLOT" href="#" />
        </div>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Looking forward to our continued collaboration.
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
