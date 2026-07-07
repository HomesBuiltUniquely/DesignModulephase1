import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface FullDayLeaveRejectedEmailProps {
  recipientName?: string;
  designerName?: string;
  blockDate?: string;
  reason?: string;
  reasonPreset?: string;
  rejectedByName?: string;
  reviewNote?: string;
}

export default function FullDayLeaveRejectedEmail({
  recipientName = 'Designer',
  designerName = 'Designer',
  blockDate = '—',
  reason = '—',
  reasonPreset,
  rejectedByName = 'Manager',
  reviewNote,
}: FullDayLeaveRejectedEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Designer', value: designerName },
    { label: 'Date', value: blockDate },
    { label: 'Category', value: reasonPreset && reasonPreset !== 'Other' ? reasonPreset : 'Full-day leave' },
    { label: 'Reason', value: reason },
    { label: 'Reviewed by', value: rejectedByName },
    ...(reviewNote ? [{ label: 'Note', value: reviewNote }] : []),
  ];

  return (
    <BaseLayout projectId="FULLDAY">
      <StageBar stageName="INTERNAL" status="NOT APPROVED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {recipientName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Full-Day Leave Not Approved
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Your full-day leave request for <strong>{blockDate}</strong> was not approved by{' '}
          <strong>{rejectedByName}</strong>. Your calendar remains available for that date.
        </Text>

        <DetailsList title="REQUEST DETAILS" items={snapshotItems} />

        <Section className="border-t border-neutral-lightGrey pt-6 mt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Design Module · Leave Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
