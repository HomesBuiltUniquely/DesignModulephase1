import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface PaymentLinkCancelledEmailProps {
  customerName?: string;
  projectId?: string;
  amountDue?: string;
  milestoneLabel?: string;
  designerName?: string;
  /** cancel | delete — same customer message; label only */
  actionLabel?: string;
}

/**
 * One template for Cancel and Delete payment link.
 * Tells the customer the previous online link is inactive — do not pay on it.
 */
export default function PaymentLinkCancelledEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  amountDue = '',
  milestoneLabel = 'Design payment',
  designerName = 'Your Design Consultant',
  actionLabel = 'cancelled',
}: PaymentLinkCancelledEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Milestone', value: milestoneLabel },
    ...(amountDue ? [{ label: 'Previous link amount', value: amountDue }] : []),
    { label: 'Link status', value: 'Inactive — do not use' },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="PAYMENT LINK" status="CANCELLED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Payment link {actionLabel}
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          The online payment link we shared with you earlier for <strong>{milestoneLabel}</strong> has been{' '}
          <strong>{actionLabel}</strong> and is no longer valid.
        </Text>

        <Section className="w-full mb-6 rounded border border-[#fecaca] bg-[#fef2f2] border-l-4 border-l-[#EF0101] p-4">
          <Text className="m-0 text-[14px] font-bold text-[#991b1b] mb-1">Please do not use the old link</Text>
          <Text className="m-0 text-[13px] leading-relaxed text-[#7f1d1d]">
            If you still have the previous email or SMS with a pay button, ignore it. That link will not complete a
            valid payment for your project. Your designer will share a new link if payment is still required.
          </Text>
        </Section>

        <DetailsList title="LINK DETAILS" items={details} />

        <Text className="m-0 mt-6 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          If you already paid successfully before this message, please reply to this email or contact your designer
          with the payment confirmation. Otherwise, wait for the next payment instructions from HUB Interior.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
