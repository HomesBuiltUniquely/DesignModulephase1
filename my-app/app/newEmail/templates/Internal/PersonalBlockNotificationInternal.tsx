import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface PersonalBlockNotificationInternalEmailProps {
  recipientName?: string;
  bookedByName?: string;
  bookedByRole?: string;
  appointmentDate?: string;
  timeRange?: string;
  durationMinutes?: number;
  reason?: string;
  reasonPreset?: string;
}

export default function PersonalBlockNotificationInternalEmail({
  recipientName = 'Team Member',
  bookedByName = 'Designer',
  bookedByRole = 'Designer',
  appointmentDate = '—',
  timeRange = '—',
  durationMinutes = 90,
  reason = '—',
  reasonPreset,
}: PersonalBlockNotificationInternalEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Booked by', value: `${bookedByName} (${bookedByRole.replace(/_/g, ' ')})` },
    { label: 'Date', value: appointmentDate },
    { label: 'Time', value: timeRange },
    { label: 'Duration', value: `${durationMinutes} minutes` },
    { label: 'Category', value: reasonPreset && reasonPreset !== 'Other' ? reasonPreset : 'Personal block' },
    { label: 'Reason', value: reason },
  ];

  return (
    <BaseLayout projectId="PERSONAL">
      <StageBar stageName="INTERNAL" status="CALENDAR BLOCK" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {recipientName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Personal Time Block Scheduled
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          <strong>{bookedByName}</strong> has blocked calendar time for personal use. This slot is now
          marked as unavailable in the appointment system (same as a client meeting block).
        </Text>

        <DetailsList title="APPOINTMENT DETAILS" items={snapshotItems} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-6">
          Please plan team scheduling around this block. No client meeting has been scheduled for this slot.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Design Module · Calendar Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
