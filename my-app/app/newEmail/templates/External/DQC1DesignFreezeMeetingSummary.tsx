import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface DQC1DesignFreezeMeetingSummaryEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  meetingDate?: string;
  propertyType?: string;
}

export default function DQC1DesignFreezeMeetingSummaryEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  meetingDate = 'October 24, 2025',
  propertyType = 'Residential Property',
}: DQC1DesignFreezeMeetingSummaryEmailProps) {
  const projectSnapshot: DetailItem[] = [
    { label: 'Meeting Date', value: meetingDate },
    { label: 'Property Type', value: propertyType },
    { label: 'Project ID', value: projectId },
    { label: 'Estimate Version', value: 'R2 – Design Freeze' },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="DQC 1" status="MEETING SUMMARY" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Design Freeze Meeting Summary
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          It was a pleasure meeting with you to finalize the design details. This summary outlines the core alignments reached during our Design Freeze discussion and the path forward for your project.
        </Text>

        <DetailsList title="PROJECT SNAPSHOT" items={projectSnapshot} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Key Design Decisions:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Final layout for living, dining and kitchen confirmed.</li>
          <li className="mb-1">Material palette and finishes frozen for all primary spaces.</li>
          <li className="mb-1">Loose furniture and décor direction aligned with the 3D views.</li>
        </ul>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 font-bold">
          Action Items &amp; Next Steps:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Share final 3D views and updated estimate document with you.</li>
          <li className="mb-1">Receive your written approval on the attached design set.</li>
          <li className="mb-1">Initiate procurement and production planning after sign-off.</li>
        </ul>

        <div className="text-center mt-6 mb-6">
          <Button text="CONFIRM APPROVAL TO PROCEED" href="#" />
        </div>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Looking forward to our continued collaboration.
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
