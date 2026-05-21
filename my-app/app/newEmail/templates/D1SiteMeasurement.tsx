import * as React from 'react';
import { Text, Link, Section } from '@react-email/components';
import { BaseLayout } from '../component/layout/BaseLayout';
import { StageBar } from '../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../component/blocks/DetailsList';
import { Button } from '../component/blocks/Button';

export interface D1SiteMeasurementEmailProps {
  customerName?: string;
  visitDate?: string;
  visitTime?: string;
  executiveName?: string;
  executivePhone?: string;
  siteAddress?: string;
  projectId?: string;
  designerName?: string;
  designerEmail?: string;
}

export default function D1SiteMeasurementEmail({
  customerName = 'Priya',
  visitDate = 'October 24, 2025',
  visitTime = '10:00 AM – 12:00 PM',
  executiveName = 'Rahul Sharma',
  executivePhone = '+91 98765 43210',
  siteAddress = '{{Site_Address}}',
  projectId = 'HI-2025-1148',
  designerName = 'Your Design Consultant',
  designerEmail = 'consultant@hubinteriors.com',
}: D1SiteMeasurementEmailProps) {
  const visitDetails: DetailItem[] = [
    { label: 'Date', value: visitDate },
    { label: 'Time', value: visitTime },
    { label: 'Site address', value: siteAddress },
    { 
      label: 'Measurement executive', 
      value: (
        <div>
          <div className="font-bold text-neutral-nearBlack">{executiveName}</div>
          <div className="text-neutral-mediumGrey text-[12px]">{executivePhone}</div>
        </div>
      )
    },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="D1 · SITE MEASUREMENT" status="VISIT CONFIRMED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Confirmation Badge */}
        <div className="inline-block bg-brand-lightBg text-brand-primary text-[11px] font-bold tracking-widest px-3 py-1.5 rounded border border-brand-mid uppercase mb-4">
          CONFIRMATION
        </div>

        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Site Measurement Visit Scheduled
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-6">
          Your upcoming site audit for the interior project has been successfully confirmed. 
          Please find the details of our visit below.
        </Text>

        {/* Visit Details List */}
        <DetailsList title="VISIT DETAILS" items={visitDetails} />

        {/* Please Note Block */}
        <Section className="bg-brand-lightBg border border-brand-mid border-l-4 border-l-brand-primary rounded p-5 my-6">
          <Text className="m-0 text-[12px] font-bold text-brand-primary mb-3 tracking-widest uppercase">
            <span className="inline-block bg-brand-primary text-neutral-white rounded-full w-3.5 h-3.5 text-center leading-[14px] text-[10px] mr-1.5">!</span>
            PLEASE NOTE
          </Text>
          <ul className="m-0 pl-4 text-neutral-nearBlack text-[14px] leading-relaxed list-disc">
            <li className="mb-2">Ensure site access and keys are ready at the scheduled time.</li>
            <li className="mb-2">Electricity availability is required for high-precision laser measurements.</li>
            <li className="mb-2">Arrange necessary gate permissions or visitor passes prior to the visit.</li>
          </ul>
        </Section>

        {/* Reschedule Note */}
        <Section className="bg-neutral-nearWhite border border-neutral-lightGrey rounded p-4 mb-8 text-center">
          <Text className="m-0 text-[14px] text-neutral-nearBlack">
            <span className="font-bold">Note:</span> if you want to reschedule connect with your Design consultant !
          </Text>
        </Section>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-1">{designerEmail}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Measurement & Site Team · Hub Interiors Bangalore</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
};
