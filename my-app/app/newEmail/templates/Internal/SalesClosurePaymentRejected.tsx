import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';

export interface SalesClosurePaymentRejectedEmailProps {
  projectId?: string;
}

export default function SalesClosurePaymentRejectedEmail({
  projectId = 'HI-2025-0000',
}: SalesClosurePaymentRejectedEmailProps) {
  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="ALERT" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Internal Notification,</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Sales Closure Payment Rejected
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          The payment required for sales closure has been rejected.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Please contact the customer to resolve this issue immediately.
        </Text>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please review the details in the system.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
