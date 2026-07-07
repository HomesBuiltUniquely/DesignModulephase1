import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface FullDayLeaveRequestInternalEmailProps {
  recipientName?: string;
  requestedByName?: string;
  requestedByRole?: string;
  blockDate?: string;
  reason?: string;
  reasonPreset?: string;
}

export default function FullDayLeaveRequestInternalEmail({
  recipientName = 'Approver',
  requestedByName = 'Designer',
  requestedByRole = 'Designer',
  blockDate = '—',
  reason = '—',
  reasonPreset,
}: FullDayLeaveRequestInternalEmailProps) {
  const snapshotItems: DetailItem[] = [
    { label: 'Requested by', value: `${requestedByName} (${requestedByRole.replace(/_/g, ' ')})` },
    { label: 'Date', value: blockDate },
    { label: 'Duration', value: 'Full day (11:00 AM – 7:00 PM)' },
    { label: 'Category', value: reasonPreset && reasonPreset !== 'Other' ? reasonPreset : 'Full-day leave' },
    { label: 'Reason', value: reason },
  ];

  return (
    <BaseLayout projectId="FULLDAY">
      <StageBar stageName="INTERNAL" status="APPROVAL REQUIRED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {recipientName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Full-Day Leave Request
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          <strong>{requestedByName}</strong> has requested a full-day leave block. Please review and approve or
          reject this request in the Design Module dashboard.
        </Text>

        <DetailsList title="REQUEST DETAILS" items={snapshotItems} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-6">
          Until approved, the designer calendar is not blocked in ERP. Once approved, the full day (11 AM – 7 PM)
          will be marked unavailable for CRM booking.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">HUB Interior</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Design Module · Leave Request</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
