import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';
import { SalesCallTermsSection, SalesTermRow } from '../../component/blocks/SalesCallTermsSection';

export interface D1SiteMeasurementEmailProps {
  customerName?: string;
  projectId?: string;
  propertyType?: string;
  designerName?: string;
  salesTerms?: SalesTermRow[];
  rmName?: string;
  rmPhone?: string;
  rmEmail?: string;
  acknowledgeHref?: string;
}

export default function D1SiteMeasurementEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  propertyType = '4-Room Apartment',
  designerName = 'Your Design Consultant',
  salesTerms,
  rmName = '',
  rmPhone = '',
  rmEmail = '',
  acknowledgeHref = '#',
}: D1SiteMeasurementEmailProps) {
  const projectDetails: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Property Type', value: propertyType },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="D1 · SITE AUDIT" status="WELCOME ONBOARD" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Let&apos;s begin your design journey
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Hi {customerName}, we&apos;re thrilled to start this creative process with you. Your dream space is
          just a few steps away from reality.
        </Text>

        <DetailsList title="OFFER CONFIRMED" items={projectDetails} />

        <SalesCallTermsSection
          salesTerms={salesTerms}
          rmName={rmName || designerName}
          rmPhone={rmPhone}
          rmEmail={rmEmail}
          acknowledgeHref={acknowledgeHref}
        />

<Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-6 font-bold">
          Here&apos;s what happens next:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">
            <span className="font-bold">Confirm Measurement Slot:</span> Select a time for our designer to
            visit your site.
          </li>
          <li className="mb-1">
            <span className="font-bold">Moodboard Presentation:</span> Review initial design directions and
            material palettes.
          </li>
          <li className="mb-1">
            <span className="font-bold">3D Visualization:</span> Experience your home through high-quality
            renders.
          </li>
        </ul>

        <div className="text-center mt-6 mb-2">
          <Button text="CONFIRM MEASUREMENT SLOT" href="#" />
        </div>

        <Section className="border-t border-neutral-lightGrey pt-6 mt-8">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
