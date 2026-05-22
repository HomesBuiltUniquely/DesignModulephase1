import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface PaymentUploadedInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  milestoneName?: string; // e.g. "10% Milestone" or "40% Milestone"
  fileNames?: string[];
}

export default function PaymentUploadedInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  milestoneName = '10% Milestone',
  fileNames = [],
}: PaymentUploadedInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Milestone', value: milestoneName },
    { label: 'Uploaded By', value: designerName },
    ...(fileNames && fileNames.length > 0
      ? [{ label: 'Uploaded Files', value: fileNames.join(', ') }]
      : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="VERIFICATION PENDING" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear Finance Team,</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Payment Uploaded for Verification ({milestoneName})
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          A new payment screenshot/receipt has been uploaded for the project listed below.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please verify this transaction from your side in your software/ERP to approve the milestone progress.
        </Text>

        {/* Project Details */}
        <DetailsList title="PAYMENT DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Kindly take prompt action to avoid any delay in the project progression.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - ERP Notification</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
