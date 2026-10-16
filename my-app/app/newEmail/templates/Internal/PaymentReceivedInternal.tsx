import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface PaymentReceivedInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  milestoneLabel?: string;
  amountPaid?: string;
  amountAchieved?: string;
  milestoneTarget?: string;
  remainingMilestone?: string;
  paymentMode?: string;
  paymentDate?: string;
  isPartial?: boolean;
}

/**
 * Internal alert when customer pays online (Easebuzz) for a specific project.
 * Sent to that project's designer / team — not a company-wide blast.
 */
export default function PaymentReceivedInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  milestoneLabel = 'Design payment',
  amountPaid = '',
  amountAchieved = '',
  milestoneTarget = '',
  remainingMilestone = '',
  paymentMode = 'Easebuzz (Online)',
  paymentDate = '',
  isPartial = false,
}: PaymentReceivedInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    { label: 'Customer', value: customerName },
    { label: 'Milestone', value: milestoneLabel },
    ...(amountPaid ? [{ label: isPartial ? 'Paid this txn' : 'Amount received', value: amountPaid }] : []),
    ...(isPartial && amountAchieved ? [{ label: 'Collected so far', value: amountAchieved }] : []),
    ...(isPartial && milestoneTarget ? [{ label: 'Milestone target', value: milestoneTarget }] : []),
    ...(isPartial && remainingMilestone ? [{ label: 'Remaining', value: remainingMilestone }] : []),
    ...(paymentMode ? [{ label: 'Payment mode', value: paymentMode }] : []),
    ...(paymentDate ? [{ label: 'Date', value: paymentDate }] : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar
        stageName="INTERNAL"
        status={isPartial ? 'PARTIAL PAYMENT' : 'PAYMENT RECEIVED'}
      />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {designerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          {isPartial
            ? `Partial payment received — ${milestoneLabel}`
            : `Payment received — ${milestoneLabel}`}
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          {isPartial
            ? `An online payment was received for project ${customerName} (${projectId}). The milestone is not fully collected yet — see amounts below.`
            : `Online payment for project ${customerName} (${projectId}) has been received and auto-approved for ${milestoneLabel}.`}
        </Text>

        <Section className="w-full mb-6 rounded border border-[#bbf7d0] bg-[#ecfdf5] border-l-4 border-l-[#059669] p-4">
          <Text className="m-0 text-[14px] font-bold text-[#065f46] mb-1">
            {isPartial ? 'Partial collection recorded' : 'Confirmed · auto-approved'}
          </Text>
          <Text className="m-0 text-[13px] leading-relaxed text-[#047857]">
            Customer confirmation email was also sent (when customer email is on file). Continue the next
            project steps in Design Module for this lead only.
          </Text>
        </Section>

        <DetailsList title="PAYMENT DETAILS" items={details} />

        <Text className="m-0 mt-6 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          This notice is for your project team only.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior — ERP Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
