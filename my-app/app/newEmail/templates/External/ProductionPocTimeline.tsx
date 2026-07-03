import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface ProductionPocTimelineEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  productionPoc?: string;
  executionPoc?: string;
  spmPoc?: string;
  operationManager?: string;
  operationHead?: string;
}

export default function ProductionPocTimelineEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  productionPoc = 'Prajwal - prajwal@hubinterior.com',
  executionPoc = 'Project Manager — hello@hubinterior.com',
  spmPoc = 'Guruvignesh - guruvignesh@hubinterior.com',
  operationManager = 'Balaji - balaji@hubinterior.com',
  operationHead = 'Alex - alex@hubinterior.com',
}: ProductionPocTimelineEmailProps) {
  const pocDetails: DetailItem[] = [
    { label: 'Production POC', value: productionPoc },
    { label: 'Execution POC', value: executionPoc },
    { label: 'Senior Project Manager', value: spmPoc },
    { label: 'Operation Manager', value: operationManager },
    { label: 'Operation Head', value: operationHead },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="PRODUCTION" status="TIMELINE UPDATE" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Production Initiated & Timeline Activated
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Thank you for your approval! We are pleased to inform you that your project has now been successfully pushed to production.
        </Text>

        {/* POC details */}
        <DetailsList title="KEY POINTS OF CONTACT" items={pocDetails} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Our team will coordinate:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Site execution planning</li>
          <li className="mb-1">Material dispatch scheduling</li>
          <li className="mb-1">Installation timelines</li>
          <li className="mb-1">Stage-wise progress updates</li>
        </ul>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-2">
          Our team will be sharing the detailed project execution timeline shortly, including tentative handover dates, so you have complete visibility on the upcoming milestones.
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
