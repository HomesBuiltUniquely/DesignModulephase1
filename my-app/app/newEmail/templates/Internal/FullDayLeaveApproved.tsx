import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface FullDayLeaveApprovedEmailProps {
  recipientName?: string;
  designerName?: string;
  blockDate?: string;
  reason?: string;
  reasonPreset?: string;
  approvedByName?: string;
}

export default function FullDayLeaveApprovedEmail({
  recipientName = 'Designer',
  designerName = 'Designer',
  blockDate = '—',
  reason = '—',
  reasonPreset,
  approvedByName = 'Manager',
}: FullDayLeaveApprovedEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Designer', value: designerName },
    { label: 'Date', value: blockDate },
    { label: 'Duration', value: 'Full day (11:00 AM – 7:00 PM)' },
    { label: 'Category', value: reasonPreset && reasonPreset !== 'Other' ? reasonPreset : 'Full-day leave' },
    { label: 'Reason', value: reason },
    { label: 'Approved by', value: approvedByName },
  ];

  return (
    <BaseLayout projectId="FULLDAY">
      <StageBar stageName="INTERNAL" status="APPROVED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {recipientName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Full-Day Leave Approved
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Your full-day leave request for <strong>{blockDate}</strong> has been approved by{' '}
          <strong>{approvedByName}</strong>. Your calendar is now blocked for the full hub day (11 AM – 7 PM).
        </Text>

        <DetailsList title="APPROVED LEAVE" items={snapshotItems} />

        <Section className="border-t border-neutral-lightGrey pt-6 mt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Design Module · Leave Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
